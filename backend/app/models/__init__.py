# Models package — import all models so db.create_all() finds them
from app.models.user       import User, Role
from app.models.assessment import Assessment
from app.models.audit_log  import AuditLog, AuditAction
