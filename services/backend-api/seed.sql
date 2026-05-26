-- TGMember backend-api seed template
-- 使用方式：sqlite3 tgmember.db < seed.sql

BEGIN TRANSACTION;

-- groups
INSERT OR IGNORE INTO groups (id, name) VALUES
  (1, 'Demo Group');

-- members
INSERT OR IGNORE INTO members (id, name, username) VALUES
  (1, 'Demo Member', 'demo_member');

-- group_members
INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES
  (1, 1);

-- member_tags
INSERT OR IGNORE INTO member_tags (member_id, tag) VALUES
  (1, 'seed');

-- member_notes
INSERT OR IGNORE INTO member_notes (member_id, note) VALUES
  (1, 'This is seeded demo data.');

COMMIT;
