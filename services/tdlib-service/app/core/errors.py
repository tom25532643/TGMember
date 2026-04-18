class TdLibError(Exception):
    def __init__(self, code: int, message: str):
        super().__init__(f'TDLib error {code}: {message}')
        self.code = code
        self.message = message


class AuthorizationError(Exception):
    pass
