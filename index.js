const express = require("express");
const axios = require("axios");
const pdf = require("pdf-parse");
const app = express();

app.use(express.json());

// ====== VERIFY TOKEN ====== //
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

// ====== HANDLE MASUKNYA PESAN ====== //
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    if (data.entry && data.entry[0].changes) {
      const change = data.entry[0].changes[0];
      const msg = change.value.messages?.[0];

      if (msg) {

        let from = msg.from; // nomor pengirim

        // Pesan teks
        if (msg.text) {
          let text = msg.text.body.toLowerCase();

          // cek jam operasional
          if (outsideJamOperasional()) {
            return sendMessage(from, "Maaf, usaha sedang tutup. Buka 08:00 - 17:00.");
          }

          return sendMessage(
            from,
            `Terima kasih telah menghubungi Pondok Fotocopy.

Buka: 08:00 - 17:00
Sabtu/Minggu: Libur

Transfer:
BCA Fahroji: 2452712963
Dana Nur Sarifah: 0851-9898-4410

Silakan kirim dokumen untuk dihitung halamannya.`
          );
        }

        // Dokumen PDF
        if (msg.document) {
          const mime = msg.document.mime_type;

          if (mime === "application/pdf") {
            let url = msg.document.link;

            // Ambil file PDF
            const pdfBuffer = await axios.get(url, { responseType: "arraybuffer" });

            const pdfData = await pdf(pdfBuffer.data);
            const halaman = pdfData.numpages;

            let warna = msg.document.caption?.toLowerCase().includes("warna");

            let harga = warna ? halaman * 1000 : halaman * 500;

            return sendMessage(
              from,
              `📄 Dokumen terdeteksi:
Jumlah halaman: ${halaman}
Jenis: ${warna ? "Berwarna" : "Hitam Putih"}
Total harga: Rp ${harga.toLocaleString()}`
            );
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ===== KIRIM PESAN ===== //
async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${process.env.PHONE_ID}/messages`,
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

function outsideJamOperasional() {
  const now = new Date();
  const jam = now.getHours();

  return jam < 8 || jam >= 17;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Bot berjalan di port " + PORT));
