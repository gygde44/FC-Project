const express = require("express");
const axios = require("axios");
const pdf = require("pdf-parse");
const app = express();

app.use(express.json({ limit: "50mb" })); // biar bisa ambil dokumen besar

// ========================
// VERIFICATION WEBHOOK
// ========================
app.get("/webhook", (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verify_token) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ========================
// HANDLE MASUKNYA PESAN
// ========================
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    const message = data.entry?.[0].changes?.[0].value.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;

    // CEK JAM OPERASIONAL
    if (outsideJamOperasional()) {
      await sendMessage(from, "Maaf, usaha sedang tutup. Buka 08:00 - 17:00.");
      return res.sendStatus(200);
    }

    // Jika mengirim dokumen PDF
    if (message.document) {
      const doc = message.document;
      if (doc.mime_type === "application/pdf") {
        const fileUrl = doc.link;

        // Ambil file PDF
        const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const dataPdf = await pdf(response.data);
        const pages = dataPdf.numpages;

        // Jika ada caption “warna”, hitung harga 1000 / halaman, else 500
        const isColor = doc.caption?.toLowerCase().includes("warna");
        const price = isColor ? pages * 1000 : pages * 500;

        await sendMessage(
          from,
          `📄 Dokumen terdeteksi\nJumlah halaman: ${pages}\nJenis: ${
            isColor ? "Berwarna" : "Hitam Putih"
          }\nHarga: Rp ${price.toLocaleString()}`
        );
        return res.sendStatus(200);
      }
    }

    // BALAS AUTO-REPLY DEFAULT
    await sendMessage(
      from,
      `Terima kasih telah menghubungi Pondok Fotocopy.

Jam operasional: 08:00 - 17:00
Sabtu/Minggu & tanggal merah: LIBUR

Transfer:
BCA Fahroji: 2452712963
Dana Nur Sarifah: 0851-9898-4410

📌 Mohon file yang sudah dititip segera diambil.`
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ========================
// KIRIM PESAN KE WHATSAPP
// ========================
async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v17.0/${process.env.PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WA_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ========================
// JAM OPERASIONAL
// ========================
function outsideJamOperasional() {
  const now = new Date();
  const hour = now.getHours();
  return hour < 8 || hour >= 17;
}

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
