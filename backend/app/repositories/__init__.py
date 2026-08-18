from app.config import settings
from app.repositories.local_repo import LocalRepository

_repo = None

def get_db():
    global _repo
    if _repo is not None:
        return _repo
        
    if settings.APP_MODE.upper() == "AWS":
        # Deferred import to prevent AWS/Boto3 errors when running locally without credentials
        from app.repositories.aws_repo import AwsRepository
        _repo = AwsRepository()
    else:
        _repo = LocalRepository()
    return _repo
