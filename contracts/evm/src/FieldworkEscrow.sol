// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The subset of ERC-20 this contract needs. USDC on Base Sepolia returns a bool from both.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title FieldworkEscrow
/// @notice Holds the USDC for a Fieldwork task and releases it on a verdict the GenLayer contract reached.
///
/// The photographs are graded on GenLayer, which cannot move USDC on Base. So the money waits here and an
/// attestor signs what GenLayer decided: pay the worker, or give the poster the money back. Anyone can submit
/// the signature, and nobody but the attestor can produce a valid one.
///
/// Trust boundary, stated plainly: the attestor is a single key. It can send a task's money to the poster or to
/// whichever worker address it signs, and to nobody else. It cannot touch a task that is not funded, cannot
/// change an amount, cannot sign twice for one task (the state moves on first use) and cannot move the fees
/// already earned. The owner rotates the attestor but never holds or moves task funds.
contract FieldworkEscrow {
    enum State {
        None,
        Funded,
        Paid,
        Refunded
    }

    /// @dev What the attestor signs. 1 pays the worker, 2 returns the money to the poster.
    uint8 public constant PAY = 1;
    uint8 public constant REFUND = 2;

    uint16 public constant MAX_FEE_BPS = 1000;
    uint64 public constant MIN_OPEN = 1 hours;
    /// @notice Time after a deadline during which only a signed verdict can move the money, so a worker who
    /// delivered before the deadline cannot lose the payout to someone calling `expire` first.
    uint64 public constant SETTLE_GRACE = 1 days;

    bytes32 private constant SETTLE_TYPEHASH =
        keccak256("Settle(uint256 taskId,address worker,uint8 outcome,uint256 expiry)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    /// @dev Upper half of the curve order. A signature in the upper half has a twin that also verifies.
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    struct Task {
        address poster;
        uint128 reward;
        uint128 fee;
        uint64 deadline;
        State state;
    }

    IERC20 public immutable usdc;
    bytes32 public immutable DOMAIN_SEPARATOR;

    address public owner;
    address public attestor;
    address public treasury;
    /// @notice Applies to tasks funded from now on. A funded task keeps the fee it was funded with.
    uint16 public feeBps;

    mapping(uint256 => Task) public tasks;

    event Funded(uint256 indexed taskId, address indexed poster, uint256 reward, uint256 fee, uint64 deadline);
    event Paid(uint256 indexed taskId, address indexed worker, uint256 reward, uint256 fee);
    event Refunded(uint256 indexed taskId, address indexed poster, uint256 amount, bool expired);
    event AttestorUpdated(address indexed attestor);
    event TreasuryUpdated(address indexed treasury);
    event FeeUpdated(uint16 feeBps);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh();
    error AlreadyFunded();
    error NotFunded();
    error DeadlineTooSoon();
    error NotExpired();
    error SignatureExpired();
    error BadSignature();
    error BadOutcome();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_, address attestor_, address treasury_, uint16 feeBps_) {
        if (usdc_ == address(0) || attestor_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        usdc = IERC20(usdc_);
        owner = msg.sender;
        attestor = attestor_;
        treasury = treasury_;
        feeBps = feeBps_;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256("FieldworkEscrow"), keccak256("1"), block.chainid, address(this)
            )
        );
        emit OwnershipTransferred(address(0), msg.sender);
        emit AttestorUpdated(attestor_);
        emit TreasuryUpdated(treasury_);
        emit FeeUpdated(feeBps_);
    }

    // ---------------------------------------------------------------- views

    /// @notice The fee charged on a reward at the current rate. Floors, so it never exceeds the rate.
    function feeFor(uint256 reward) public view returns (uint256) {
        return (reward * feeBps) / 10_000;
    }

    /// @notice The digest the attestor signs for a verdict.
    function settlementDigest(uint256 taskId, address worker, uint8 outcome, uint256 expiry)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(SETTLE_TYPEHASH, taskId, worker, outcome, expiry))
            )
        );
    }

    // ---------------------------------------------------------------- writes

    /// @notice Lock the reward and the fee for a task. `taskId` is the task's id on the GenLayer contract.
    /// @param deadline Zero for no deadline, else at least an hour from now (the GenLayer floor).
    function fund(uint256 taskId, uint128 reward, uint64 deadline) external {
        if (reward == 0) revert ZeroAmount();
        if (tasks[taskId].state != State.None) revert AlreadyFunded();
        if (deadline != 0 && deadline < block.timestamp + MIN_OPEN) revert DeadlineTooSoon();

        uint128 fee = uint128(feeFor(reward));
        tasks[taskId] =
            Task({poster: msg.sender, reward: reward, fee: fee, deadline: deadline, state: State.Funded});
        emit Funded(taskId, msg.sender, reward, fee, deadline);

        _pull(msg.sender, uint256(reward) + fee);
    }

    /// @notice Release a funded task on a verdict signed by the attestor. Anyone may submit it.
    /// @param worker Who is paid when `outcome` is PAY. Ignored for REFUND, but still part of the signature.
    function settle(uint256 taskId, address worker, uint8 outcome, uint256 expiry, bytes calldata signature)
        external
    {
        if (block.timestamp > expiry) revert SignatureExpired();
        if (outcome != PAY && outcome != REFUND) revert BadOutcome();
        Task storage t = tasks[taskId];
        if (t.state != State.Funded) revert NotFunded();
        if (_signer(settlementDigest(taskId, worker, outcome, expiry), signature) != attestor) {
            revert BadSignature();
        }

        address poster = t.poster;
        uint256 reward = t.reward;
        uint256 fee = t.fee;

        if (outcome == PAY) {
            if (worker == address(0)) revert ZeroAddress();
            t.state = State.Paid;
            emit Paid(taskId, worker, reward, fee);
            _push(worker, reward);
            if (fee != 0) _push(treasury, fee);
        } else {
            t.state = State.Refunded;
            emit Refunded(taskId, poster, reward + fee, false);
            _push(poster, reward + fee);
        }
    }

    /// @notice Return the money to the poster once the deadline and the grace period have passed with no verdict.
    /// This is the Base side of GenLayer's `expire_task`.
    function expire(uint256 taskId) external {
        Task storage t = tasks[taskId];
        if (t.state != State.Funded) revert NotFunded();
        if (t.deadline == 0 || block.timestamp <= uint256(t.deadline) + SETTLE_GRACE) revert NotExpired();

        t.state = State.Refunded;
        uint256 amount = uint256(t.reward) + t.fee;
        emit Refunded(taskId, t.poster, amount, true);
        _push(t.poster, amount);
    }

    // ----------------------------------------------------------------- admin

    function setAttestor(address attestor_) external onlyOwner {
        if (attestor_ == address(0)) revert ZeroAddress();
        attestor = attestor_;
        emit AttestorUpdated(attestor_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setFeeBps(uint16 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = feeBps_;
        emit FeeUpdated(feeBps_);
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    // -------------------------------------------------------------- internals

    function _signer(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) revert BadSignature();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }

    function _pull(address from, uint256 amount) private {
        if (!usdc.transferFrom(from, address(this), amount)) revert TransferFailed();
    }

    function _push(address to, uint256 amount) private {
        if (!usdc.transfer(to, amount)) revert TransferFailed();
    }
}
