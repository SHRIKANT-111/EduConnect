module.exports = (io) => {
    const rooms = {};

    io.on('connection', (socket) => {
        console.log('✅ User connected:', socket.id);

        // JOIN ROOM
        socket.on('join-room', ({ roomId, userId, userName, role }) => {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.userId = userId;
            socket.userName = userName;
            socket.role = role;

            if (!rooms[roomId]) rooms[roomId] = {};
            rooms[roomId][socket.id] = { userId, userName, role, handRaised: false };

            console.log(`👤 ${userName} (${role}) joined room ${roomId}`);

            // Tell everyone else in room that new user joined
            socket.to(roomId).emit('user-joined', {
                socketId: socket.id,
                userId,
                userName,
                role
            });

            // Send current participants list to new user
            socket.emit('room-participants', Object.entries(rooms[roomId])
                .filter(([sid]) => sid !== socket.id)
                .map(([sid, u]) => ({ socketId: sid, ...u }))
            );
        });

        // WEBRTC SIGNALING
        socket.on('offer', ({ to, offer }) => {
            console.log(`📡 Offer from ${socket.id} to ${to}`);
            io.to(to).emit('offer', { from: socket.id, offer, userName: socket.userName });
        });

        socket.on('answer', ({ to, answer }) => {
            console.log(`📡 Answer from ${socket.id} to ${to}`);
            io.to(to).emit('answer', { from: socket.id, answer });
        });

        socket.on('ice-candidate', ({ to, candidate }) => {
            io.to(to).emit('ice-candidate', { from: socket.id, candidate });
        });

        // CHAT
        socket.on('chat-message', ({ roomId, message }) => {
            console.log(`💬 Chat in ${roomId}: ${socket.userName}: ${message}`);
            io.in(roomId).emit('chat-message', {
                userName: socket.userName,
                role: socket.role,
                message,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        });

        // RAISE HAND
        socket.on('raise-hand', ({ roomId }) => {
            if (rooms[roomId] && rooms[roomId][socket.id]) {
                rooms[roomId][socket.id].handRaised = !rooms[roomId][socket.id].handRaised;
                const raised = rooms[roomId][socket.id].handRaised;
                console.log(`✋ ${socket.userName} ${raised ? 'raised' : 'lowered'} hand`);
                io.in(roomId).emit('hand-raised', {
                    socketId: socket.id,
                    userName: socket.userName,
                    raised
                });
            }
        });

        // DISCONNECT
        socket.on('disconnect', () => {
            const roomId = socket.roomId;
            if (roomId && rooms[roomId]) {
                delete rooms[roomId][socket.id];
                if (Object.keys(rooms[roomId]).length === 0) delete rooms[roomId];
                socket.to(roomId).emit('user-left', {
                    socketId: socket.id,
                    userName: socket.userName
                });
                console.log(`❌ ${socket.userName} left room ${roomId}`);
            }
        });
    });
};