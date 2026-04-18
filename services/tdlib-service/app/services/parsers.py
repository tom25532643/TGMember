def parse_message(msg: dict) -> dict:
    content = msg.get('content', {})
    content_type = content.get('@type')
    text = None

    if content_type == 'messageText':
        text = content.get('text', {}).get('text')

    sender_id = None
    sender = msg.get('sender_id', {})
    sender_type = sender.get('@type')

    if sender_type == 'messageSenderUser':
        sender_id = sender.get('user_id')
    elif sender_type == 'messageSenderChat':
        sender_id = sender.get('chat_id')

    return {
        'id': msg.get('id'),
        'chat_id': msg.get('chat_id'),
        'date': msg.get('date'),
        'edit_date': msg.get('edit_date', 0),
        'sender_type': sender_type,
        'sender_id': sender_id,
        'content_type': content_type,
        'text': text,
        'is_outgoing': bool(msg.get('is_outgoing', False)),
        'raw': msg,
    }

def parse_message_preview(msg: dict | None) -> dict | None:
    if not msg:
        return None

    content = msg.get('content', {})
    content_type = content.get('@type')

    text = ""

    if content_type == 'messageText':
        text = content.get('text', {}).get('text')

    elif content_type == 'messagePhoto':
        text = '[Photo]'

    elif content_type == 'messageDocument':
        text = '[Document]'

    elif content_type == 'messageSticker':
        text = '[Sticker]'

    elif content_type == 'messageVoiceNote':
        text = '[Voice]'

    else:
        text = f'[{content_type}]'

    return {
        'id': msg.get('id'),
        'date': msg.get('date'),
        'content_type': content_type,
        'text': text,
        'is_outgoing': bool(msg.get('is_outgoing', False)),
    }