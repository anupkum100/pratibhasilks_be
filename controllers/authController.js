const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();
    const name = payload.name || "Admin";

    const allowedAdmins = process.env.ADMIN_EMAILS
      .split(",")
      .map((item) => item.trim().toLowerCase());

    if (!email || !allowedAdmins.includes(email)) {
      return res.status(403).json({ message: "This Google account is not allowed for admin access." });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId: payload.sub,
        avatar: payload.picture,
        role: "admin",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Admin account is disabled." });
    }

    res.json({
      token: generateToken(user),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(401).json({ message: "Google login failed.", error: error.message });
  }
};

module.exports = { googleLogin };