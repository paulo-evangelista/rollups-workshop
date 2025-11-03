from os import environ
import logging
import requests

logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)

rollup_server = environ["ROLLUP_HTTP_SERVER_URL"]
logger.info(f"HTTP rollup_server url is {rollup_server}")

###
# Aux Functions 

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


def send_notice(notice):
    send_post("notice",notice)

def send_report(report):
    send_post("report",report)


def send_post(endpoint,json_data):
    response = requests.post(rollup_server + f"/{endpoint}", json=json_data)
    logger.info(f"/{endpoint}: Received response status {response.status_code} body {response.content}")


def handle_advance(data):
    global counter
    logger.info(f"Received advance request data {data}")

    counter += 1
    logger.info(f"Counter incremented to {counter}")

    notice_payload = str2hex(f"Counter value: {counter}")
    send_notice({"payload": notice_payload})

    return "accept"


def handle_inspect(data):
    payload = data["payload"]
    logger.info(f"Received inspect request {payload}")
    send_report({"payload": payload})
    return "accept"


handlers = {
    "advance_state": handle_advance,
    "inspect_state": handle_inspect,
}

finish = {"status": "accept"}
counter = 0

while True:
    logger.info("Sending finish")
    response = requests.post(rollup_server + "/finish", json=finish)
    logger.info(f"Received finish status {response.status_code}")
    if response.status_code == 202:
        logger.info("No pending rollup request, trying again")
    else:
        rollup_request = response.json()
        data = rollup_request["data"]
        handler = handlers[rollup_request["request_type"]]
        finish["status"] = handler(rollup_request["data"])
