from os import environ
import logging
import requests
from eth_abi import encode

logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)

rollup_server = environ["ROLLUP_HTTP_SERVER_URL"]
logger.info(f"HTTP rollup_server url is {rollup_server}")

# Portal addresses
ERC20_PORTAL_ADDRESS = "0xc700D6aDd016eECd59d989C028214Eaa0fCC0051".lower()
INPUT_BOX_ADDRESS = "0xc70074BDD26d8cF983Ca6A5b89b8db52D5850051".lower()

# print(Web3.keccak(b"transfer(address,uint256)"))
ERC20_TRANSFER_FUNCTION_SELECTOR = b'\xa9\x05\x9c\xbb*\xb0\x9e\xb2\x19X?JY\xa5\xd0b:\xde4m\x96+\xcdNF\xb1\x1d\xa0G\xc9\x04\x9b'[:4]


def str2hex(string):
    """
    Encode a string as an hex string
    """
    return binary2hex(str2binary(string))


def str2binary(string):
    """
    Encode a string as an binary string
    """
    return string.encode("utf-8")


def binary2hex(binary):
    """
    Encode a binary as an hex string
    """
    return "0x" + binary.hex()


def hex2binary(hexstr):
    """
    Decodes a hex string into a regular byte string
    """
    return bytes.fromhex(hexstr[2:])


def hex2str(hexstr):
    """
    Decodes a hex string into a regular string
    """
    return hex2binary(hexstr).decode("utf-8")


def send_voucher(voucher):
    send_post("voucher", voucher)


def send_notice(notice):
    send_post("notice", notice)


def send_report(report):
    send_post("report", report)


def send_exception(exception):
    send_post("exception", exception)


def send_post(endpoint, json_data):
    response = requests.post(rollup_server + f"/{endpoint}", json=json_data)
    logger.info(
        f"/{endpoint}: Received response status {response.status_code} body {response.content}")


def handle_erc20_deposit(payload):
    """
    Process ERC20 deposit from portal and create voucher to return tokens
    Payload format from ERC20Portal:
    - bytes 0-1: success (bool)
    - bytes 1-21: token address
    - bytes 21-41: depositor address
    - bytes 41-73: amount (uint256)
    - bytes 73+: extra data
    """
    binary = hex2binary(payload)

    # Parse deposit data
    token_address = binary2hex(binary[:20])
    depositor = binary2hex(binary[20:40])
    amount = int.from_bytes(binary[40:72], "big")
    deposit_data = binary[72:]

    logger.info(f"ERC20 Deposit received:")
    logger.info(f"Token: {token_address}")
    logger.info(f"Depositor: {depositor}")
    logger.info(f"Amount: {amount}")
    logger.info(f"Deposit data: {deposit_data}")

    if amount == 0:
        logger.info("Amount is 0, skipping voucher creation")
        send_report(
            {"payload": str2hex("Deposit amount was 0, no action taken")})
        return

    # Create voucher to transfer tokens back to depositor
    # Function to be called in voucher [token_address].transfer([address receiver],[uint256 amount])
    receiver = depositor
    data = encode(['address', 'uint256'], [receiver, amount])
    voucher_payload = binary2hex(ERC20_TRANSFER_FUNCTION_SELECTOR + data)

    voucher = {
        "destination": token_address,
        # No ETH value for ERC20 transfers
        "value": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "payload": voucher_payload
    }

    send_voucher(voucher)
    logger.info(f"Voucher created to return {amount} tokens to {depositor}")

    # Send notice about the operation
    notice_payload = str2hex(
        f"Processed ERC20 deposit: {amount} tokens from {depositor}, voucher created")
    send_notice({"payload": notice_payload})


def handle_advance(data):
    logger.info(f"Received advance request data")

    status = "accept"
    sender = data["metadata"]["msg_sender"].lower()
    payload = data["payload"]

    try:
        # Check if input came from ERC20 Portal
        if sender == ERC20_PORTAL_ADDRESS:
            logger.info("Input from ERC20 Portal - processing deposit")
            handle_erc20_deposit(payload)

        # Check if input came from InputBox (regular user input)
        else:
            logger.info(f"Input from {sender} - processing as regular input")
            try:
                # Try to decode as string
                payload_str = hex2str(payload)
                logger.info(f"Received string input: {payload_str}")

                notice_payload = str2hex(f"Received input: {payload_str}")
                send_notice({"payload": notice_payload})
            except Exception as e:
                logger.info(f"Could not decode payload as string: {e}")
                send_report(
                    {"payload": str2hex(f"Unknown input format from {sender}")})

    except Exception as e:
        status = "reject"
        msg = f"Error processing input: {e}"
        logger.error(msg)
        send_report({"payload": str2hex(msg)})

    return status


def handle_inspect(data):
    logger.info(f"Received inspect request data {data}")
    payload = data["payload"]
    send_report({"payload": payload})
    return "accept"


handlers = {
    "advance_state": handle_advance,
    "inspect_state": handle_inspect,
}

finish = {"status": "accept"}

while True:
    logger.info("Sending finish")
    response = requests.post(rollup_server + "/finish", json=finish)
    logger.info(f"Received finish status {response.status_code}")
    if response.status_code == 202:
        logger.info("No pending rollup request, trying again")
    else:
        rollup_request = response.json()
        handler = handlers[rollup_request["request_type"]]
        finish["status"] = handler(rollup_request["data"])
