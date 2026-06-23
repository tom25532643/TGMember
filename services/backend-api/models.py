from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from database import Base


class MemberModel(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    username = Column(String, nullable=False)


class GroupModel(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)


class GroupMemberModel(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("group_id", "member_id", name="uq_group_member"),
    )


class MemberTagModel(Base):
    __tablename__ = "member_tags"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    tag = Column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint("member_id", "tag", name="uq_member_tag"),
    )


class MemberNoteModel(Base):
    __tablename__ = "member_notes"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    note = Column(String, nullable=False)


class MessageLogModel(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    direction = Column(String, nullable=False)   # outbound / inbound
    content = Column(String, nullable=False)
    status = Column(String, nullable=False)      # sent / failed / received

class TelegramMemberExpirationModel(Base):
    __tablename__ = "telegram_member_expirations"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(String, nullable=False, index=True)
    chat_id = Column(BigInteger, nullable=False, index=True)
    telegram_user_id = Column(BigInteger, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    first_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expiration_date = Column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "owner_user_id",
            "chat_id",
            "telegram_user_id",
            name="uq_telegram_member_expiration",
        ),
    )


