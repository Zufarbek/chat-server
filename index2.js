const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

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
    email: {
        type: String,
        required: true,
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    chats: [

    ],
});

const User = mongoose.model('User', userSchema);

app.use(express.json());

const adminSecretToken = 'admin-secret-token';
const jwtSecretKey = 'your-secret-key';

// Foydalanuvchini qo'shish
app.post('/api/user/login', async (req, res) => {
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
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ikromifortik@gmail.com', // О'зингизнинг Gmail почтангиз
        pass: 'ndpqhuynthzovwre', // О'зингизнинг Gmail паролингиз
    },
});

// Tokenni olish va foydalanuvchi ma'lumotlarini ko'rish
app.post('/api/user/signin', async (req, res) => {
    const { email } = req.body;

    try {
        // Foydalanuvchi bazasida emailni tekshirish
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Foydalanuvchi topilmadi' });
        }

        // Parolni yuborish
        const generatedPassword = Math.random().toString(36).substring(2); // Avtomatik parol generatsiya qilish
        user.password = generatedPassword; // Foydalanuvchiga yangi parolni saqlash
        await user.save();

        // Gmail pochtangizga parolni yuborish
        const mailOptions = {
            from: 'ikromifortik@gmail.com', // O'zingizning Gmail pochtangiz
            to: email,
            subject: 'Yangi Parol',
            text: `Yangi parolingiz: ${generatedPassword}`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                res.status(500).json({ success: false, message: 'Parolni yuborishda xatolik yuz berdi' });
            } else {
                console.log('Parol yuborildi: ' + info.response);
                res.json({ success: true, message: 'Parol Gmail pochtangizga yuborildi' });
            }
        });
    } catch (error) {
        console.log('Xatolik yuz berdi:', error);
        res.status(500).json({ success: false, message: 'Foydalanuvchi ma\'lumotlarni olishda xatolik yuz berdi' });
    }
});

// Parolni yangilash va tekshirish uchun yangi POST end point
app.post('/api/signin/resetpassword', async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        // Foydalanuvchi bazasida emailni tekshirish
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Foydalanuvchi topilmadi' });
        }

        // Yangi parolni foydalanuvchiga o'rnating
        user.password = newPassword;

        // Foydalanuvchining ma'lumotlarini saqlash
        await user.save();

        // Tokenni olish va foydalanuvchi ma'lumotlarini qaytarish
        const token = jwt.sign({ userId: user._id }, jwtSecretKey);
        const { name, email: userEmail, isAdmin, _id: userId } = user;

        // Malumotlarda foydalanuvchi identifikatorini (ID) qo'shib qo'yamiz
        const userInfo = { name, email: userEmail, userId };

        // Yangi parolni muvaffaqiyatli o'zgartirilgan xabar qaytarish
        res.json({ success: true, message: 'Parol muvaffaqiyatli o\'zgartirildi', user: userInfo, token });
    } catch (error) {
        console.log('Xatolik yuz berdi:', error);
        res.status(500).json({ success: false, message: 'Parolni o\'zgartirishda xatolik yuz berdi', error: error.message });
    }
});

// Foydalanuvchini admin sifatida yaratish
app.post('/api/admin/create', async (req, res) => {
    const userData = req.body;
    try {
        // Ilovalik yaratishda o'zgartirish kiritishingiz mumkin
        userData.isAdmin = true;

        const newUser = new User(userData);
        await newUser.save();

        const tokenPayload = { userId: newUser._id, adminUserId: newUser._id };  // Admin foydalanuvchisining ID-sini qo'shib qo'yamiz
        const token = jwt.sign(tokenPayload, jwtSecretKey);

        res.json({ success: true, message: 'Admin foydalanuvchi muvaffaqiyatli saqlandi', token });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Admin foydalanuvchi saqlashda xatolik yuz berdi' });
    }
});

// Server kodida chat yaratish
app.post('/api/user/chat/:id', async (req, res) => {
    const userId = req.params.id; // URL dan foydalanuvchi ID sini olish
    const messageData = req.body; // Klientdan kelgan xabar ma'lumotlari

    try {
        // Foydalanuvchi ma'lumotlarini olish
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
        }
        const currentTime = new Date();
        // Yangi xabar obyektini yaratish va unga yangi ID yaratish
        const newMessage = {
            id: generateRandomId(),
            time: currentTime.toLocaleTimeString(),
            messageData
        };

        // Foydalanuvchi chats massivida yangi xabarni qo'shing
        user.chats.push(newMessage);

        // Foydalanuvchini yangilash va saqlash
        await user.save();

        // Muvaffaqiyatli javobni qaytarish
        res.json({ success: true, message: 'Xabar foydalanuvchiga yuborildi' });
    } catch (error) {
        console.error('Xabar yuborishda xatolik yuz berdi', error);
        res.status(500).json({ success: false, message: 'Xabar yuborishda xatolik yuz berdi', error: error.message });
    }
});

// Random ID yaratish uchun funksiya
function generateRandomId() {
    return Math.floor(Math.random() * 10000000000000000); // O'zingizni kerakli shaklga o'zgartirishingiz mumkin
}

// Aidminlar olish tokin bilan
app.get('/api/admins', async (req, res) => {
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
        const adminUsers = await User.find({ isAdmin: true }, { _id: 1, name: 1 });

        res.json(adminUsers);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Foydalanuvchilarni olishda xatolik yuz berdi' });
    }
});

// Server kodida
app.get('/api/users/beztoken', async (req, res) => {
    try {
        // Foydalanuvchilarni olish
        const adminUsers = await User.find({ isAdmin: false }, { _id: 1, name: 1, email: 1, isAdmin: 1, chats: 1 });

        res.json(adminUsers);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Foydalanuvchilarni olishda xatolik yuz berdi' });
    }
});


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
app.delete('/api/user/chat/:userId/:chatId', async (req, res) => {
    const userId = req.params.userId; // URL dan foydalanuvchi ID sini olish
    const chatId = req.params.chatId; // URL dan chat ID sini olish

    try {
        // Foydalanuvchi ma'lumotlarini olish
        const user = await User.findById(userId);
        // console.log(user);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
        }

        // Chatni o'chirish
        const chatIndex = user.chats.findIndex(chat => chat.id == chatId);
        console.log(chatIndex);

        if (chatIndex === -1) {
            return res.status(404).json({ success: false, message: 'Chat topilmadi' });
        }

        user.chats.splice(chatIndex, 1);

        // Foydalanuvchini yangilash va saqlash
        await user.save();

        // Muvaffaqiyatli javobni qaytarish
        return res.json({ success: true, message: 'Chat o\'chirildi' });
    } catch (error) {
        console.error('Chatni o\'chirishda xatolik yuz berdi', error);
        return res.status(500).json({ success: false, message: 'Xatolik yuz berdi', error: error.message });
    }
});



const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server ishga tushdi.Port: ${PORT}`);
});