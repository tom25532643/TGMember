def parse_message(message: dict) -> dict:
    content = message.get("content") or {}
    content_type = content.get("@type")

    result = {
        "id": str(message.get("id")),
        "chat_id": str(message.get("chat_id")),
        "date": message.get("date"),
        "sender_id": ((message.get("sender_id") or {}).get("user_id")),
        "is_outgoing": message.get("is_outgoing", False),
        "content_type": content_type,
        "text": "",
        "media": None,
    }

    if content_type == "messageText":
        text_obj = content.get("text") or {}
        result["text"] = text_obj.get("text", "")

    elif content_type == "messagePhoto":
        photo = content.get("photo") or {}
        sizes = photo.get("sizes") or []

        best_file = None

        if sizes:
            # 取最大張，通常最後一個最大
            best = sizes[-1]
            best_file = best.get("photo") or {}

        caption = content.get("caption") or {}

        result["text"] = caption.get("text") or ""
        result["media"] = {
            "type": "photo",
            "file_id": best_file.get("id") if best_file else None,
            "width": best.get("width") if sizes else None,
            "height": best.get("height") if sizes else None,
        }

    elif content_type == "messageVideo":
        video = content.get("video") or {}
        file_obj = video.get("video") or {}

        result["media"] = {
            "type": "video",
            "file_id": file_obj.get("id"),
            "duration": video.get("duration"),
            "width": video.get("width"),
            "height": video.get("height"),
        }

        caption = content.get("caption") or {}
        result["text"] = caption.get("text", "")

    return result

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