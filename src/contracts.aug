// aug-spec: "contracts.aug.md" explains this file. Read it before changes; refresh with aug spec.
TensorError(int code, string message) implements Error:
    /** Explain the native failure without losing its original message. */
    explain() returns string:
        return message
