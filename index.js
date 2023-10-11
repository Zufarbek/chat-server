    const express = require('express');
    const http = require('http');
    const socketIo = require('socket.io');
    const fs = require('fs');
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');

    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    mongoose.connect('mongodb://localhost/mydatabase', { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection;
    db.on('error', console.error.bind(console, 'MongoDB ulanishi xatosi:'));
    db.once('open', function () {
        console.log('MongoDBga ulanish muvaffaqiyatli!');
    });

    const dataFolder = './data';
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder);
    }

    const userSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true,
        },
        phoneNumber: {
            type: String,
            required: true,
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        chats: [
            {
                withUser: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                messages: [
                    {
                        from: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: 'User',
                        },
                        text: String,
                        name: String, // Foydalanuvchi nomi
                        date: {
                            type: Date,
                            default: Date.now,
                        },
                    },
                ],
            },
        ],
    });

    const User = mongoose.model('User', userSchema);

    app.use(express.json());

    const adminSecretToken = 'admin-secret-token';
    const jwtSecretKey = 'your-secret-key';

    // Foydalanuvchini qo'shish
    app.post('/api/user', async (req, res) => {
        const userData = req.body;
        try {
            const isAdmin = req.headers['authorization-token'];
            if (isAdmin === adminSecretToken) {
                userData.isAdmin = true;
            } else {
                userData.isAdmin = false;
            }

            const newUser = new User(userData);
            await newUser.save();

            const token = jwt.sign({ userId: newUser._id }, jwtSecretKey);

            res.json({ success: true, message: 'Foydalanuvchi saqlandi', token });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Foydalanuvchi saqlashda xatolik yuz berdi' });
        }
    });

    // Adminni yaratish
// app.post('/api/admin/create', async (req, res) => {
//     const { phoneNumber, password } = req.body;
//     try {
//         const adminData = {
//             name: 'Admin',
//             phoneNumber: '+998917903523',
//             isAdmin: true,
//         };

//         const newAdmin = new User(adminData);
//         await newAdmin.save();

//         const adminToken = jwt.sign({ userId: newAdmin._id }, jwtSecretKey);

//         res.json({ success: true, message: 'Admin yaratildi', adminToken });
//     } catch (error) {
//         res.status(500).json({ success: false, message: 'Admin yaratishda xatolik yuz berdi' });
//     }
// });

   


    // Tokenni olish va foydalanuvchi ma'lumotlarini ko'rish
app.post('/api/signin', async (req, res) => {
    const { phoneNumber } = req.body;
    try {
        const user = await User.findOne({ phoneNumber });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Foydalanuvchi topilmadi' });
        }

        const token = jwt.sign({ userId: user._id }, jwtSecretKey);

        // Foydalanuvchi ma'lumotlarini ham qaytarish
        res.json({ success: true, message: 'Tizimga muvaffaqiyatli kirildi', token, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kirishda xatolik yuz berdi' });
    }
});

    // Adminni yaratish
    // app.post('/api/admin/create', async (req, res) => {
    //     const { phoneNumber, password } = req.body;
    //     try {
    //         const adminData = {
    //             name: 'Admin',
    //             phoneNumber: '+998917903523',
    //             isAdmin: true,
    //         };

    //         const newAdmin = new User(adminData);
    //         await newAdmin.save();

    //         const adminToken = jwt.sign({ userId: newAdmin._id }, jwtSecretKey);

    //         res.json({ success: true, message: 'Admin yaratildi', adminToken });
    //     } catch (error) {
    //         res.status(500).json({ success: false, message: 'Admin yaratishda xatolik yuz berdi' });
    //     }
    // });

    // Tokenni olish
    // app.get('/api/token/:id', async (req, res) => {
    //     const userId = req.params.id; // Foydalanuvchi ID-sini olish
    //     try {
    //         const user = await User.findById(userId);
    //         if (!user) {
    //             return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    //         }

    //         // Foydalanuvchidan tokenni olish
    //         const token = jwt.sign({ userId: user._id }, jwtSecretKey);

    //         res.json({ success: true, message: 'Token muvaffaqiyatli olingan', token });
    //     } catch (error) {
    //         res.status(500).json({ success: false, message: 'Tokenni olishda xatolik yuz berdi' });
    //     }
    // });

    // Foydalanuvchilarni olish tokin bilan
    app.get('/api/users', async (req, res) => {
    try {
        const token = req.headers['authorization'];

        if (!token) {
            return res.status(401).json({ success: false, message: 'Token topilmadi' });
        }

        const decoded = jwt.verify(token, jwtSecretKey);
        const userId = decoded.userId;

        const user = await User.findById(userId);

        if (!user || !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Sizda foydalanish huquqi yo\'q' });
        }

        // Foydalanuvchilarni olish
        const adminUsers = await User.find({ isAdmin: false }, { _id: 1, name: 1 });

        res.json(adminUsers);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Foydalanuvchilarni olishda xatolik yuz berdi' });
    }
});


    // // Foydalanuvchi ma'lumotlarini olish
    // app.get('/api/users', async (req, res) => {
    //     try {
    //         const users = await User.find();
    //         res.json(users);
    //     } catch (error) {
    //         res.status(500).json({ success: false, message: 'Foydalanuvchilarni olishda xatolik yuz berdi' });
    //     }
    // });

    
    // Admin foydalanuvchisi chatni olib keladi
    app.get('/api/admin/getChat/:userId', async (req, res) => {
        const adminUserId = req.params.userId; // Adminning ID-si
        try {
            // Admin foydalanuvchisini tekshiramiz
            const adminUser = await User.findById(adminUserId);

            if (!adminUser) {
                return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
            }

            // Barcha chatlarni olib olamiz
            const allChats = adminUser.chats;

            // Chatlardan faqat userlar orqali bo'lganlarni tanlaymiz
            const userChats = allChats.filter(chat => !chat.withUser.isAdmin);

            // User chatlarini qaytarib beramiz
            res.json({ success: true, message: 'Chatlar muvaffaqiyatli olinadi', chats: userChats });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Chatlarni olishda xatolik yuz berdi' });
        }
    });

    // Tokenni olish
    // app.get('/api/token', async (req, res) => {
    //     const token = req.headers['authorization'];

    //     try {
    //         if (!token) {
    //             return res.status(401).json({ success: false, message: 'Token topilmadi' });
    //         }

    //         const decoded = jwt.verify(token, jwtSecretKey);
    //         const userId = decoded.userId;

    //         const user = await User.findById(userId);

    //         if (user) {
    //             res.json(user);
    //         } else {
    //             res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    //         }
    //     } catch (error) {
    //         res.status(500).json({ success: false, message: 'Tokenni tekshirishda xatolik yuz berdi' });
    //     }
    // });

    // Foydalanuvchini o'chirish
    app.delete('/api/user/:id', async (req, res) => {
        const userId = req.params.id;
        try {
            const deletedUser = await User.findByIdAndDelete(userId);
            if (deletedUser) {
                res.json({ success: true, message: 'Foydalanuvchi o\'chirildi' });
            } else {
                res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: 'Foydalanuvchi o\'chirishda xatolik yuz berdi' });
        }
    });

    // Chatni o'chirish
    app.delete('/api/user/chat/:chatId', async (req, res) => {
        const chatId = req.params.chatId;
        try {
            const user = await User.findOne({ "chats._id": chatId });

            if (!user) {
                return res.status(404).json({ success: false, message: 'Chat topilmadi' });
            }

            const chatIndex = user.chats.findIndex(chat => chat._id.toString() === chatId);

            if (chatIndex === -1) {
                return res.status(404).json({ success: false, message: 'Chat topilmadi' });
            }

            user.chats.splice(chatIndex, 1);
            await user.save();

            res.json({ success: true, message: 'Chat o\'chirildi' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Chatni o\'chirishda xatolik yuz berdi' });
        }
    });

    io.on('connection', (socket) => {
        console.log('Foydalanuvchi ulandi:', socket.id);

        socket.on('disconnect', () => {
            console.log('Foydalanuvchi chiqdi:', socket.id);
        });

        socket.on('get_user', async (userId) => {
            try {
                const user = await User.findById(userId);
                if (user) {
                    io.to(socket.id).emit('user_data', user);
                } else {
                    io.to(socket.id).emit('user_not_found', 'Foydalanuvchi topilmadi');
                }
            } catch (error) {
                console.error('Foydalanuvchi topishda xatolik yuz berdi');
                io.to(socket.id).emit('error', 'Foydalanuvchi topishda xatolik yuz berdi');
            }
        });

        socket.on('create_chat', async (data) => {
            const { userId, withUserId } = data;
            try {
                const user = await User.findById(userId);
                const withUser = await User.findById(withUserId);

                if (!user || !withUser) {
                    io.to(socket.id).emit('chat_error', 'Foydalanuvchilar topilmadi');
                    return;
                }

                const newChat = {
                    withUser: withUser._id,
                    messages: [],
                };
                user.chats.push(newChat);
                await user.save();

                io.to(socket.id).emit('chat_created', 'Chat yaratildi', newChat._id.toString());
            } catch (error) {
                console.error('Chat yaratishda xatolik yuz berdi');
                io.to(socket.id).emit('chat_error', 'Chat yaratishda xatolik yuz berdi');
            }
        });

        socket.on('send_message', async (data) => {
            const { userId, chatId, messageText } = data;
            try {
                const user = await User.findById(userId);
                if (!user) {
                    io.to(socket.id).emit('message_error', 'Foydalanuvchi topilmadi');
                    return;
                }

                const chat = user.chats.find((c) => c._id.toString() === chatId);
                if (!chat) {
                    io.to(socket.id).emit('message_error', 'Chat topilmadi');
                    return;
                }

                chat.messages.push({ from: userId, text: messageText, name: user.name });
                await user.save();

                const withUser = await User.findById(chat.withUser);
                io.to(socket.id).emit('message_sent', 'Xabar yuborildi');
                io.to(withUser._id.toString()).emit('message_received', 'Xabar oldingiz', chatId);
            } catch (error) {
                console.error('Xabar yuborishda xatolik yuz berdi');
                io.to(socket.id).emit('message_error', 'Xabar yuborishda xatolik yuz berdi');
            }
        });
    });

    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => {
        console.log(`Server ishga tushdi. Port: ${PORT}`);
    });
