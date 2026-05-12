import os
import uuid
import aiohttp
from aiohttp import web

class UploadHandlers:
    def __init__(self, db):
        self.db = db
        self.upload_dir = "data/file"
        os.makedirs(self.upload_dir, exist_ok=True)

    async def handle_upload(self, request):
        try:
            reader = await request.multipart()
            
            # /api/upload
            field = await reader.next()
            if not field or field.name != 'file':
                return web.json_response({"success": False, "error": "No file field found"}, status=400)

            filename = field.filename
            if not filename:
                return web.json_response({"success": False, "error": "No filename found"}, status=400)

            # Generate unique filename to avoid collisions
            ext = os.path.splitext(filename)[1]
            unique_name = f"{uuid.uuid4()}{ext}"
            file_path = os.path.join(self.upload_dir, unique_name)

            size = 0
            with open(file_path, 'wb') as f:
                while True:
                    chunk = await field.read_chunk()
                    if not chunk:
                        break
                    size += len(chunk)
                    f.write(chunk)

            return web.json_response({
                "success": True, 
                "filename": filename,
                "path": unique_name,
                "size": size
            })
        except Exception as e:
            print(f"Upload error: {e}")
            return web.json_response({"success": False, "error": str(e)}, status=500)
