from .users import AppRole, Profile, Notification
from .core import LeadStatus, Company, Lead, Contact, Document
from .sales import DealStatus, Pipeline, Stage, Deal, DealStageHistory, QuoteStatus, Product, Quote, QuoteLineItem
from .activities import ActivityType, TaskType, Priority, Activity, CustomTaskStatus, Task, EmailTemplate
from .mailer import MailingList, MailingListContact, Campaign
from .rbac import Permission, Role, RolePermission
from database import Base

__all__ = [
    "AppRole", "Profile", "Notification",
    "LeadStatus", "Company", "Lead", "Contact", "Document",
    "DealStatus", "Pipeline", "Stage", "Deal", "DealStageHistory", "QuoteStatus", "Product", "Quote", "QuoteLineItem",
    "ActivityType", "TaskType", "Priority", "Activity", "CustomTaskStatus", "Task", "EmailTemplate",
    "MailingList", "MailingListContact", "Campaign",
    "Permission", "Role", "RolePermission",
    "Base"
]

from sqlalchemy.orm import relationship

# Configure relationships that were missing from the model definitions

Company.profiles = relationship("Profile", foreign_keys=[Company.owner_id])
Lead.profiles = relationship("Profile", foreign_keys=[Lead.owner_id])

Contact.companies = relationship("Company", foreign_keys=[Contact.company_id])
Contact.profiles = relationship("Profile", foreign_keys=[Contact.owner_id])

Document.deals = relationship("Deal", foreign_keys=[Document.deal_id])
Document.contacts = relationship("Contact", foreign_keys=[Document.contact_id])
Document.profiles = relationship("Profile", foreign_keys=[Document.uploaded_by])

Pipeline.stages = relationship("Stage", back_populates="pipelines")
Stage.pipelines = relationship("Pipeline", back_populates="stages", foreign_keys=[Stage.pipeline_id])

Deal.pipelines = relationship("Pipeline", foreign_keys=[Deal.pipeline_id])
Deal.stages = relationship("Stage", foreign_keys=[Deal.stage_id])
Deal.contacts = relationship("Contact", foreign_keys=[Deal.contact_id])
Deal.companies = relationship("Company", foreign_keys=[Deal.company_id])
Deal.profiles = relationship("Profile", foreign_keys=[Deal.owner_id])

DealStageHistory.from_stage = relationship("Stage", foreign_keys=[DealStageHistory.from_stage_id])
DealStageHistory.to_stage = relationship("Stage", foreign_keys=[DealStageHistory.to_stage_id])
DealStageHistory.profiles = relationship("Profile", foreign_keys=[DealStageHistory.changed_by])

Quote.line_items = relationship("QuoteLineItem", backref="quote")
Quote.deals = relationship("Deal", foreign_keys=[Quote.deal_id])

Activity.profiles = relationship("Profile", foreign_keys=[Activity.user_id])
Task.profiles = relationship("Profile", foreign_keys=[Task.assignee_id])

# RBAC
Role.permissions = relationship("Permission", secondary="role_permissions", backref="roles")
