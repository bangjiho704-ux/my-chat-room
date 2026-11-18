const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname)));

const roomsData = {
    '오버워치방': { waiting: [], approved: ['방장'], messages: [], pinned: '' },
    '발로란트방': { waiting: [], approved: ['방장'], messages: [], pinned: '' },
    '브롤스타즈방': { waiting: [], approved: ['방장'], messages: [], pinned: '' }
};

io.on('connection', (socket) => {
    let currentRoom = '';
    let currentName = '';
    let isOwner = false;

    socket.on('join_room_request', ({ room, name }) => {
        currentRoom = room;
        currentName = name;
        socket.join(room);

        if (!roomsData[room].waiting.includes(name) && !roomsData[room].approved.includes(name)) {
            roomsData[room].waiting.push(name);
        }
        updateRoomState(room);
    });

    socket.on('owner_login', ({ room, password }) => {
        if (password === '1234') {
            currentRoom = room;
            currentName = '방장';
            isOwner = true;
            socket.join(room);
            socket.emit('owner_login_success');
            updateRoomState(room);
        } else {
            socket.emit('login_failed', '비밀번호가 틀렸습니다.');
        }
    });

    socket.on('accept_user', ({ room, name }) => {
        if (roomsData[room]) {
            roomsData[room].waiting = roomsData[room].waiting.filter(n => n !== name);
            if (!roomsData[room].approved.includes(name)) {
                roomsData[room].approved.push(name);
            }
            updateRoomState(room);
        }
    });

    socket.on('reject_user', ({ room, name }) => {
        if (roomsData[room]) {
            roomsData[room].waiting = roomsData[room].waiting.filter(n => n !== name);
            updateRoomState(room);
        }
    });

    socket.on('send_message', ({ room, text, isOwnerMsg }) => {
        if (roomsData[room]) {
            const msg = {
                id: Date.now() + Math.random(),
                name: isOwnerMsg ? '방장' : currentName,
                text: text,
                isOwner: isOwnerMsg,
                liked: false
            };
            roomsData[room].messages.push(msg);
            if (isOwnerMsg) {
                roomsData[room].pinned = text;
            }
            updateRoomState(room);
        }
    });

    socket.on('toggle_like', ({ room, msgId }) => {
        if (roomsData[room]) {
            roomsData[room].messages = roomsData[room].messages.map(m => {
                if (String(m.id) === String(msgId)) {
                    m.liked = !m.liked;
                }
                return m;
            });
            updateRoomState(room);
        }
    });

    socket.on('close_room', ({ room }) => {
        if (roomsData[room]) {
            roomsData[room].messages = [];
            roomsData[room].waiting = [];
            roomsData[room].approved = ['방장'];
            roomsData[room].pinned = '';
            io.to(room).emit('room_closed');
        }
    });

    function updateRoomState(room) {
        io.to(room).emit('room_state_update', {
            waiting: roomsData[room].waiting,
            approved: roomsData[room].approved,
            messages: roomsData[room].messages,
            pinned: roomsData[room].pinned
        });
    }

    socket.on('disconnect', () => {
        if (currentRoom && currentName && !isOwner) {
            if (roomsData[currentRoom]) {
                roomsData[currentRoom].waiting = roomsData[currentRoom].waiting.filter(n => n !== currentName);
                updateRoomState(currentRoom);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
