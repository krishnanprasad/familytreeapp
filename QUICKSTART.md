# Quick Start Guide - My Family App

## 🚀 Getting Started in 5 Minutes

### Step 1: Install & Run
```bash
cd familytreeapp
npm install
npm start
```
Open http://localhost:4200/

### Step 2: Create Your Ancestor
1. Click "🌳 Start Your Family Tree"
2. Enter: Name, Gender, Age, Location, and check "Alive"
3. Click Save

### Step 3: Add Family Members
- **👶 Add Child**: Click the baby icon on any person
- **💑 Add Spouse**: Click the couple icon to link a spouse
- **✏️ Edit**: Modify information anytime
- **🗑️ Delete**: Remove a person (cascades to children)

### Step 4: Organize Your Tree
- **Drag nodes** on the canvas to reposition them
- **Click nodes** to see details
- **⭐ Star**: Mark someone as "current user" (highlighted in blue)

### Step 5: Export Your Data
- **📥 JSON**: Download complete family data
- **📥 CSV**: Open in Excel/Google Sheets
- **🗑️ Clear**: Delete all (be careful!)

## 📊 Color Legend

| Color | Meaning |
|-------|---------|
| 🟨 Gold | Ancestor (root) |
| 🔵 Blue | Current User |
| 🔷 Dark Blue | Male member |
| 🔴 Pink | Female member |
| 🟢 Green | Spouse |
| ⚪ Gray | Deceased |

## 💾 Your Data
- Automatically saved to browser storage
- Persists across sessions
- Download JSON backup regularly!

## 🎯 Common Tasks

### Add Multiple Children to One Parent
1. Click the parent in the sidebar
2. Click 👶 for each child
3. Fill in their info and save

### Track Deceased Family Member
1. Click the person or edit button
2. Uncheck "Alive"
3. They'll appear grayed out with ✗

### Change Current User
1. Click ⭐ on the person you want to highlight
2. They'll be shown in bright blue

### Backup Your Tree
1. Click 📥 JSON button
2. Save the file somewhere safe
3. Do this regularly!

## ⚙️ Settings & Features

### Mandatory Fields
- Name ✓
- Gender ✓
- Age ✓
- Alive Status ✓

### Optional Fields
- Location
- Photo (future)
- Notes (future)

## 🐛 Troubleshooting

**Tree not loading?**
- Refresh the page
- Check browser console (F12)
- Clear cache if needed

**Can't add members?**
- Create ancestor first
- Check if all required fields are filled

**Data lost?**
- Check localStorage (F12 → Application → Local Storage)
- Restore from exported JSON

## 📱 Mobile Usage

- Responsive design adapts to mobile
- Sidebar becomes horizontal
- Pinch-to-zoom coming soon
- Works offline (no internet needed)

## 🔐 Privacy

- All data stored locally in your browser
- No cloud upload unless you export
- No analytics or tracking
- Complete privacy control

---

**Need help?** Check README.md for full documentation!
