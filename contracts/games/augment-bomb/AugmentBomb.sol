// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title The AugmentBomb contract
/// @author Huy Tran
contract AugmentBomb is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    struct Game {
        string randomHex;
        uint32 resultNumber;
        uint256 betAmount;
        uint256 startTime;
        uint256 endTime;
        address[] playerAddreses;
    }

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @dev stores the mapping for game Id to get game data
    mapping(string => Game) private _gameMap;

    /* ========== EVENTS ========== */
    event GameStarted(string roundId, uint256 startTime, uint256 betAmount);

    event GameEnded(string roundId, uint256 endTime, uint32 resultNumber);

    /* ========== MODIFIERS ========== */
    modifier gameMustExist(string calldata gameId) {
        Game memory game = _gameMap[gameId];
        require(game.startTime != 0, "gameMustExist: game not found");

        _;
    }

    modifier gameMustNotExist(string calldata gameId) {
        Game memory game = _gameMap[gameId];
        require(game.startTime == 0, "gameMustNotExist: existing game found");

        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev The initialize function for upgradeable smart contract's initialization phase
    function initialize() external initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /// @dev Pause the smart contract in case of emergency
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @dev unpause the smart contract when everything is safe
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function startGame(
        uint256 betAmount,
        string calldata gameId
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused gameMustNotExist(gameId) {
        Game memory newGame;

        newGame.betAmount = betAmount;
        newGame.startTime = block.timestamp;

        _gameMap[gameId] = newGame;
    }

    function endGame(
        string calldata gameId,
        string calldata randomHex,
        uint32 resultNumber
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused gameMustExist(gameId) {
        Game storage foundGame = _gameMap[gameId];

        foundGame.endTime = block.timestamp;
        foundGame.randomHex = randomHex;
        foundGame.resultNumber = resultNumber;
    }

    function viewGameById(
        string calldata gameId
    ) public view gameMustExist(gameId) returns (Game memory) {
        Game memory foundGame = _gameMap[gameId];

        return foundGame;
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(UPGRADER_ROLE) {}
}
