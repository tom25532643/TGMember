from sqlalchemy import func
from sqlalchemy.orm import Session
from models import (
    MemberModel,
    GroupModel,
    GroupMemberModel,
    MemberTagModel,
    MemberNoteModel,
    MessageLogModel,
    TelegramMemberExpirationModel,
)


def list_members(db: Session):
    return db.query(MemberModel).all()


def get_member_by_id(db: Session, member_id: int):
    return db.query(MemberModel).filter(MemberModel.id == member_id).first()


def get_member_by_username(db: Session, username: str):
    return get_member_by_login_key(db, username)



def normalize_login_key(login_key: str):
    return login_key.strip()


def validate_login_key(login_key: str, member_id: int | None = None):
    normalized = normalize_login_key(login_key)

    if not normalized:
        raise ValueError("Login key is required")

    if len(normalized) < 8:
        raise ValueError("Login key must be at least 8 characters")

    if normalized.isdigit():
        raise ValueError("Login key cannot be only numbers")

    if member_id is not None and normalized == str(member_id):
        raise ValueError("Login key cannot match the User ID")

    return normalized


def get_member_by_login_key(db: Session, login_key: str):
    normalized = normalize_login_key(login_key)
    if not normalized:
        return None
    return (
        db.query(MemberModel)
        .filter(func.lower(MemberModel.username) == normalized.lower())
        .first()
    )


def update_member_login_key(db: Session, member_id: int, login_key: str):
    member = get_member_by_id(db, member_id)
    if not member:
        return None

    normalized = validate_login_key(login_key, member_id=member_id)
    existing = get_member_by_login_key(db, normalized)
    if existing and existing.id != member_id:
        raise ValueError("Login key is already in use")

    member.username = normalized
    db.commit()
    db.refresh(member)
    return member

def create_member(db: Session, name: str, username: str):
    normalized = validate_login_key(username)
    if get_member_by_login_key(db, normalized):
        raise ValueError("Login key is already in use")
    member = MemberModel(name=name, username=normalized)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def list_groups(db: Session):
    return db.query(GroupModel).all()


def get_group_by_id(db: Session, group_id: int):
    return db.query(GroupModel).filter(GroupModel.id == group_id).first()


def create_group(db: Session, name: str):
    group = GroupModel(name=name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def list_group_members(db: Session, group_id: int):
    return (
        db.query(MemberModel)
        .join(GroupMemberModel, MemberModel.id == GroupMemberModel.member_id)
        .filter(GroupMemberModel.group_id == group_id)
        .all()
    )


def add_member_to_group(db: Session, group_id: int, member_id: int):
    existing = (
        db.query(GroupMemberModel)
        .filter(
            GroupMemberModel.group_id == group_id,
            GroupMemberModel.member_id == member_id,
        )
        .first()
    )

    if not existing:
        row = GroupMemberModel(group_id=group_id, member_id=member_id)
        db.add(row)
        db.commit()

    return list_group_members(db, group_id)


def list_member_tags(db: Session, member_id: int):
    rows = db.query(MemberTagModel).filter(MemberTagModel.member_id == member_id).all()
    return [row.tag for row in rows]


def add_tag_to_member(db: Session, member_id: int, tag: str):
    existing = (
        db.query(MemberTagModel)
        .filter(MemberTagModel.member_id == member_id, MemberTagModel.tag == tag)
        .first()
    )

    if not existing:
        row = MemberTagModel(member_id=member_id, tag=tag)
        db.add(row)
        db.commit()

    return list_member_tags(db, member_id)


def list_member_notes(db: Session, member_id: int):
    rows = db.query(MemberNoteModel).filter(MemberNoteModel.member_id == member_id).all()
    return [row.note for row in rows]


def add_note_to_member(db: Session, member_id: int, note: str):
    row = MemberNoteModel(member_id=member_id, note=note)
    db.add(row)
    db.commit()
    return list_member_notes(db, member_id)

def list_member_message_logs(db: Session, member_id: int):
    return (
        db.query(MessageLogModel)
        .filter(MessageLogModel.member_id == member_id)
        .all()
    )


def create_message_log(db: Session, member_id: int, direction: str, content: str, status: str):
    row = MessageLogModel(
        member_id=member_id,
        direction=direction,
        content=content,
        status=status,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

def list_telegram_member_expirations(db: Session, owner_user_id: str, chat_id: int):
    return (
        db.query(TelegramMemberExpirationModel)
        .filter(
            TelegramMemberExpirationModel.owner_user_id == owner_user_id,
            TelegramMemberExpirationModel.chat_id == chat_id,
        )
        .order_by(TelegramMemberExpirationModel.display_name.asc())
        .all()
    )


def get_telegram_member_expiration(
    db: Session,
    owner_user_id: str,
    chat_id: int,
    telegram_user_id: int,
):
    return (
        db.query(TelegramMemberExpirationModel)
        .filter(
            TelegramMemberExpirationModel.owner_user_id == owner_user_id,
            TelegramMemberExpirationModel.chat_id == chat_id,
            TelegramMemberExpirationModel.telegram_user_id == telegram_user_id,
        )
        .first()
    )


def sync_telegram_member_expirations(db: Session, owner_user_id: str, chat_id: int, members: list[dict]):
    for member in members:
        telegram_user_id = int(member["telegram_user_id"])
        row = get_telegram_member_expiration(
            db=db,
            owner_user_id=owner_user_id,
            chat_id=chat_id,
            telegram_user_id=telegram_user_id,
        )

        if not row:
            row = TelegramMemberExpirationModel(
                owner_user_id=owner_user_id,
                chat_id=chat_id,
                telegram_user_id=telegram_user_id,
            )
            db.add(row)

        row.display_name = member.get("display_name")
        row.username = member.get("username")

    db.commit()
    return list_telegram_member_expirations(db, owner_user_id, chat_id)


def update_telegram_member_expiration(
    db: Session,
    owner_user_id: str,
    chat_id: int,
    telegram_user_id: int,
    expiration_date: str | None,
):
    row = get_telegram_member_expiration(
        db=db,
        owner_user_id=owner_user_id,
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
    )

    if not row:
        row = TelegramMemberExpirationModel(
            owner_user_id=owner_user_id,
            chat_id=chat_id,
            telegram_user_id=telegram_user_id,
        )
        db.add(row)

    row.expiration_date = expiration_date
    db.commit()
    db.refresh(row)
    return row


