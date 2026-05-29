# 🎬 Steam Fusion - Jellyfin Reseller Management Platform

A comprehensive reseller management panel for Jellyfin media servers. Built for businesses that need to manage multiple resellers, clients, and subscriptions.

![License](https://img.shields.io/badge/License-MIT-yellow) ![Node.js](https://img.shields.io/badge/Node.js-18%2B-green) ![Jellyfin](https://img.shields.io/badge/Jellyfin-10.8%2B-purple)

## ✨ Features

### Admin Dashboard
- **Reseller Management**: Create, edit, disable, and delete reseller accounts
- **Credit System**: Add credits to resellers for client creation
- **Client Overview**: View all clients across all resellers
- **Expiry Management**: Edit client expiry dates manually
- **Client Transfer**: Move clients between resellers
- **Notes System**: Add notes to clients for tracking
- **Login Tracking**: View reseller login history with IP and country
- **Search & Sort**: Find clients quickly, sort by various fields
- **Backup System**: Download database backups
- **Credit History**: Track all credit transactions

### Reseller Dashboard
- **Trial Creation**: Create new trial clients (costs 1 credit)
- **Trial Extension**: Extend clients by 1 or 3 months
- **Password Reset**: Reset client passwords instantly
- **Client Management**: View and manage all their clients
- **Notes**: Add notes to individual clients
- **Expiry Alerts**: See clients expiring within 3 days
- **Expired View**: View all expired clients
- **Credit History**: Track their credit transactions

### Automation
- **Cron Jobs**: Automatic expiry checking every 5 minutes
- **Telegram Notifications**: Alerts for expired clients and low credits
- **Jellyfin Integration**: Real-time user creation and management

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js, Express.js |
| **Frontend** | EJS templates, vanilla JavaScript |
| **Database** | JSON file-based (no external DB needed) |
| **Authentication** | bcrypt password hashing, express-session |
| **API** | Jellyfin REST API |
| **Notifications** | Telegram Bot API |

## 📋 Prerequisites

- Node.js 18 or higher
- Jellyfin server (version 10.8+)
- Jellyfin API key
- Telegram bot token (optional, for notifications)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/pythonandyou/steam-fusion.git
cd steam-fusion
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Required environment variables:
```env
JELLYFIN_URL=http://your-jellyfin-server:8096
JELLYFIN_API_KEY=your-api-key
SESSION_SECRET=your-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

### 4. Run the Server

```bash
node app.js
```

The panel will be available at `http://localhost:3030`

### 5. First Login

Use the admin credentials you set in `.env`:
- Default: `admin` / `admin123` (change this immediately!)

## 📁 Project Structure

```
steam-fusion/
├── app.js                 # Main Express application
├── check-expired.js       # Cron job for expiry checking
├── import_users.js        # Bulk user import utility
├── package.json           # Dependencies
├── .env.example           # Environment template
├── db/
│   └── data.json          # JSON database
├── views/
│   ├── login.ejs          # Login page
│   ├── admin/
│   │   └── dashboard.ejs  # Admin dashboard
│   └── reseller/
│       └── dashboard.ejs  # Reseller dashboard
└── public/
    └── logo.jpg          # Branding asset
```

## 🔧 Configuration

### Jellyfin Setup

1. Go to Jellyfin Dashboard → API Keys
2. Create a new API key
3. Copy the key to your `.env` file

### Telegram Bot (Optional)

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)
3. Add credentials to `.env`

### Cron Jobs

The system includes automatic expiry checking. To enable:

```bash
# Add to crontab (every 5 minutes)
*/5 * * * * cd /path/to/steam-fusion && node check-expired.js
```

## 📊 Database Schema

### Clients
```javascript
{
  id: Number,
  username: String,
  password: String,
  jellyfinId: String,
  resellerId: Number,
  trialStart: Date,
  trialEnd: Date,
  isPaid: Boolean,
  note: String,
  expired: Boolean
}
```

### Resellers
```javascript
{
  id: Number,
  username: String,
  password: String (bcrypt hash),
  credits: Number,
  active: Boolean,
  createdAt: Date,
  createdBy: Number,
  lastLogin: Date,
  lastIp: String
}
```

## 🔒 Security Features

- bcrypt password hashing
- Session-based authentication
- API key protection
- Input validation
- No downloads allowed for trial users
- Hidden trial users from login screen

## 📈 Business Model

This system supports a reseller business model:
1. Admin creates reseller accounts and allocates credits
2. Resellers use credits to create trial accounts for their clients
3. Resellers can extend trials by purchasing more credits
4. Expired accounts are automatically disabled

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Rudi** - [pythonandyou](https://github.com/pythonandyou)

---

## 🎯 Roadmap

- [ ] WhatsApp integration for notifications
- [ ] Payment gateway integration
- [ ] Content request system
- [ ] Multi-server support
- [ ] Usage statistics and reports
- [ ] Email notifications
- [ ] Two-factor authentication

---

*Built with ❤️ for the Jellyfin reseller community*