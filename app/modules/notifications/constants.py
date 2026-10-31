PENDING = "pending"
PROCESSING = "processing"
SENT = "sent"
FAILED = "failed"
CANCELED = "canceled"
# в БД встречается и британское написание
CANCELLED = "cancelled"

TERMINAL_STATUSES = {SENT, FAILED, CANCELED, CANCELLED}

DEFAULT_MAX_ATTEMPTS = 5
