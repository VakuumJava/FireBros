class DomainError(Exception):
    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NoData(DomainError):
    status_code = 404


class TooManyRows(DomainError):
    status_code = 413


class DataUnavailable(DomainError):
    status_code = 503
