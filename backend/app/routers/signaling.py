from typing import Dict, List
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

router = APIRouter(tags=["WebRTC Teleconsultation Signaling"])

class ConnectionManager:
    def __init__(self):
        # Maps appointment_id (room) to a list of connected WebSockets
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []

        # Prune dead/closed connections from the room
        self.rooms[room_id] = [
            conn for conn in self.rooms[room_id]
            if conn.client_state == WebSocketState.CONNECTED
        ]

        self.rooms[room_id].append(websocket)

        # Notify existing participants that a new peer joined
        peer_count = len(self.rooms[room_id])
        notify_data = json.dumps({
            "type": "peer-joined",
            "room_id": room_id,
            "peer_count": peer_count
        })

        stale_connections = []
        for connection in self.rooms[room_id]:
            if connection != websocket:
                try:
                    await connection.send_text(notify_data)
                except Exception:
                    stale_connections.append(connection)

        for conn in stale_connections:
            if conn in self.rooms[room_id]:
                self.rooms[room_id].remove(conn)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms:
            if websocket in self.rooms[room_id]:
                self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast_to_room(self, message: str, room_id: str, sender: WebSocket):
        if room_id in self.rooms:
            stale_connections = []
            for connection in self.rooms[room_id]:
                if connection != sender:
                    try:
                        await connection.send_text(message)
                    except Exception:
                        stale_connections.append(connection)
            for conn in stale_connections:
                if conn in self.rooms[room_id]:
                    self.rooms[room_id].remove(conn)

manager = ConnectionManager()

@router.websocket("/ws/video-call/{appointment_id}")
async def video_call_signaling(websocket: WebSocket, appointment_id: str):
    """
    WebSocket endpoint for WebRTC peer-to-peer video call signaling.
    Relays offer, answer, and ice-candidate messages between Doctor and Patient
    in the same appointment room. No media is stored on the server.
    """
    await manager.connect(websocket, appointment_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Relay WebRTC signaling JSON payload (offer, answer, ice-candidate) to peer in room
            await manager.broadcast_to_room(data, appointment_id, sender=websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, appointment_id)
        # Notify remaining peer about disconnection
        disconnect_msg = json.dumps({
            "type": "peer-left",
            "room_id": appointment_id
        })
        await manager.broadcast_to_room(disconnect_msg, appointment_id, sender=websocket)
    except Exception:
        manager.disconnect(websocket, appointment_id)

