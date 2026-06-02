ALTER TABLE chat_messages ADD COLUMN is_anydesk_request INTEGER DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN anydesk_id TEXT;
ALTER TABLE chat_messages ADD COLUMN user_email TEXT;
ALTER TABLE chat_messages ADD COLUMN status TEXT DEFAULT 'unread';
