"""Loopback-only fixture for check:audio; requires aiosendspin (see README)."""
import asyncio
import math
import struct
import logging
from aiohttp import web, WSMsgType
from aiosendspin.noise.keys import Identity
from aiosendspin.noise.trust_store import InMemoryServerPairingStore
from aiosendspin.server import SendspinServer, ClientAddedEvent, AudioFormat


async def main():
    server = SendspinServer(asyncio.get_running_loop(), Identity.generate(),
                            'Decksona test', pairing_store=InMemoryServerPairingStore())
    client_id = None
    stream_task = None
    received_commands = []

    def players():
        client = server.get_client(client_id) if client_id else None
        local = [{'player_id': 'test-local', 'name': 'Decksona test', 'available': bool(client and client.is_connected), 'enabled': True, 'volume_level': 100,
                  'provider': 'universal_player', 'output_protocols': [{'protocol_domain': 'sendspin', 'output_protocol_id': client_id}]}] if client_id else []
        return [{'player_id': 'remote-z', 'name': 'Z test speaker', 'available': True, 'enabled': True, 'volume_level': 40},
                {'player_id': 'offline', 'name': 'A offline speaker', 'available': False, 'enabled': True, 'volume_level': 40},
                {'player_id': 'remote', 'name': 'A test speaker', 'available': True, 'enabled': True, 'volume_level': 40}] + local

    def result(command):
        return players() if command == 'players/all' else [] if command in ('player_queues/all', 'player_queues/items') else None

    async def stream(client):
        await server.trust_unpaired(client.client_id)
        await asyncio.sleep(1)
        print(f'CLIENT roles={client.active_role_ids} group={client.group.group_id}', flush=True)
        output = client.group.start_stream()
        pcm = b''.join(struct.pack('<hh', int(1000 * math.sin(i * math.tau * 440 / 48000)),
                                 int(1000 * math.sin(i * math.tau * 440 / 48000))) for i in range(4800))
        try:
            for _ in range(300):
                output.prepare_audio(pcm, AudioFormat(sample_rate=48000, bit_depth=16, channels=2))
                await output.commit_audio()
                if _ == 0:
                    print('AUDIO SENT', flush=True)
                await asyncio.sleep(.08)
        finally:
            output.stop()

    def event(_server, event):
        nonlocal client_id, stream_task
        if isinstance(event, ClientAddedEvent):
            client_id = event.client_id
            stream_task = asyncio.create_task(stream(server.get_client(client_id)))
            stream_task.add_done_callback(lambda task: print(f'STREAM DONE: {task.exception()}' if not task.cancelled() else 'STREAM CANCELLED', flush=True))

    server.add_event_listener(event)
    await server.start_server(port=18927, host='127.0.0.1', advertise_addresses=[], discover_clients=False)

    async def api(request):
        command = (await request.json()).get('command')
        return web.json_response({'result': result(command)})

    async def websocket(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        async for frame in ws:
            if frame.type == WSMsgType.TEXT:
                message = frame.json()
                received_commands.append(message)
                await ws.send_json({'message_id': message.get('message_id'), 'result': result(message.get('command'))})
        return ws

    async def status(_request):
        return web.json_response({'players': players(), 'commands': received_commands})

    async def drop(_request):
        client = server.get_client(client_id) if client_id else None
        if client and client.connection:
            await client.connection.disconnect()
        return web.json_response({'dropped': bool(client)})

    app = web.Application()
    app.router.add_post('/api', api)
    app.router.add_get('/ws', websocket)
    app.router.add_get('/status', status)
    app.router.add_post('/drop', drop)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, '127.0.0.1', 18995).start()
    print('READY', flush=True)
    try:
        await asyncio.Event().wait()
    finally:
        if stream_task:
            stream_task.cancel()
        await server.stop_server()
        await runner.cleanup()


logging.basicConfig(level=logging.INFO)
asyncio.run(main())
