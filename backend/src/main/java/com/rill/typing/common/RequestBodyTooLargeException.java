package com.rill.typing.common;

import java.io.IOException;

final class RequestBodyTooLargeException extends IOException {

    RequestBodyTooLargeException() {
        super("API request body exceeds the configured limit");
    }
}
