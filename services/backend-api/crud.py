from sqlalchemy.orm import Session
from models import (
    MemberModel,
    GroupModel,
    GroupMemberModel,
    MemberTagModel,
    MemberNoteModel,
    MessageLogModel,
)


def list_members(db: Session):
    return db.query(MemberModel).all()


def get_member_by_id(db: Session, member_id: int):
    return db.query(MemberModel).filter(MemberModel.id == member_id).first()


def create_member(db: Session, name: str, username: str):
    member = MemberModel(name=name, username=username)
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