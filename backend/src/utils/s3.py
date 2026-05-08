import os
from functools import lru_cache
import boto3


@lru_cache(maxsize=1)
def _get_client():
    return boto3.client(
        "s3",
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        region_name="us-east-1",
    )


def _bucket() -> str:
    return os.environ["AWS_S3_BUCKET"]


def uploadToS3(file_bytes: bytes, key: str, content_type: str) -> str:
    _get_client().put_object(Bucket=_bucket(), Key=key, Body=file_bytes, ContentType=content_type)
    return f"https://{_bucket()}.s3.amazonaws.com/{key}"


def downloadFromS3(key: str) -> bytes:
    response = _get_client().get_object(Bucket=_bucket(), Key=key)
    return response["Body"].read()
