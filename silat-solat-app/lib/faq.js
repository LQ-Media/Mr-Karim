// Tanya Ustaz Silat: the ten launch answers from the spec. They are DRAFTS
// written for the Ustaz to correct, so they stay hidden from the public until
// FAQ_APPROVED=1 is set (or he publishes his own edits in admin › Tanya Ustaz,
// which are stored in the database and shown instead).
export const FAQ = [
  {
    q: ["Adakah silat itu syirik?", "Is silat syirik?"],
    a: [
      "Silat ialah seni bela diri: kuda-kuda, pukulan, elakan dan disiplin. Yang boleh menjadikan sesuatu amalan salah ialah apa yang ditambah padanya, seperti azimat, seruan kepada selain Allah, atau kepercayaan bahawa guru atau sesuatu benda mempunyai kuasa. Silat & Solat mengajar seni fizikal dan adab sahaja, dan setiap kelas dibuka dan ditutup dengan doa.",
      "Silat itself is a martial art: stances, strikes, defence and discipline. What can make any practice wrong is what gets attached to it, such as charms, invocations to other than Allah, or belief that a guru or object holds power. Silat & Solat teaches the physical art and adab only, and opens and closes every class with doa.",
    ],
  },
  {
    q: ["Bagaimana dengan ilmu kebal, jampi dan amalan dalam sesetengah perguruan?", "What about ilmu kebal, jampi and amalan in some perguruan?"],
    a: [
      "Kami tidak mengajar atau menggunakannya. Kekuatan datang dari latihan, dan perlindungan datang daripada Allah semata-mata. Jika anda pernah berada dalam perguruan yang mengajar perkara sebegini dan berasa ragu, Ustaz sedia berbincang secara peribadi.",
      "We don't teach or use them. Strength comes from training, and protection comes from Allah alone. If you've been in a school that taught such things and feel unsure, the Ustaz is happy to talk it through privately.",
    ],
  },
  {
    q: ["Bolehkah wanita belajar silat?", "Can women learn silat?"],
    a: [
      "Boleh. Setiap cawangan ada kelas Muslimah, diajar oleh jurulatih wanita, di ruang tertutup. Pakaian latihan menutup aurat; tudung sukan digalakkan.",
      "Yes. Every branch runs a sisters' class, taught by a female instructor, in a closed space. Training clothes cover the aurat; a sports hijab is recommended.",
    ],
  },
  {
    q: ["Dari umur berapa anak saya boleh sertai?", "From what age can my child join?"],
    a: [
      "Aliran kanak-kanak untuk umur 7 hingga 12. Remaja 13 tahun ke atas menyertai kelas malam bersama dewasa. Adik-beradik yang lebih kecil boleh menonton, tetapi kami belum mendaftar bawah 7 tahun.",
      "The kids' stream is for ages 7 to 12. Teens from 13 join the evening class with adults. Younger siblings can watch, but we don't enrol under-7s yet.",
    ],
  },
  {
    q: ["Saya tidak cergas dan tidak pernah berlatih. Bolehkah saya sertai?", "I'm unfit and have never trained. Can I still join?"],
    a: [
      "Boleh, kebanyakan orang bermula begitu. Kelas Bengkung Putih membina kecergasan secara beransur-ansur, dan jurulatih menyesuaikan latihan mengikut tahap anda. Beritahu jurulatih tentang sebarang kecederaan atau keadaan kesihatan semasa mendaftar.",
      "Yes, most people start that way. White-sash classes build fitness gradually, and instructors scale drills to your level. Tell your instructor about any injury or medical condition when you register.",
    ],
  },
  {
    q: ["Kenapa ada tabik hormat dalam silat? Bukankah itu salah?", "Why do you bow or salute in silat? Isn't that wrong?"],
    a: [
      "Kami tidak rukuk atau sujud kepada sesiapa. Salam hormat ialah isyarat tangan tanda hormat, seperti memberi salam, kepada guru dan rakan latihan.",
      "We do not bow (rukuk) or prostrate to anyone. The salam hormat is a hand gesture of respect, like a greeting, given to the guru and training partner.",
    ],
  },
  {
    q: ["Kenapa berlatih di masjid, dan adakah ia bertembung dengan solat?", "Why train in a mosque, and does it clash with solat?"],
    a: [
      "Berlatih di masjid mendekatkan anak muda kepadanya, dan jadual kelas disusun mengikut waktu solat supaya semua solat berjemaah. Sebab itulah namanya: Lepas Silat, Solat.",
      "Training in the mosque keeps young people close to it, and the class schedule is built around prayer times so everyone prays in jemaah. Hence the name: Lepas Silat, Solat.",
    ],
  },
  {
    q: ["Berapa bayarannya?", "What does it cost?"],
    a: [
      "Kelas adalah percuma. Ahli yang mampu boleh memilih pelan sokongan bulanan dari S$10 hingga S$100 untuk membantu peralatan dan kos. Tiada sesiapa ditolak kerana tidak menyumbang.",
      "Classes are free. Members who can afford it may choose a monthly support plan from S$10 to S$100 to help with equipment and running costs. No one is turned away for not giving.",
    ],
  },
  {
    q: ["Apa yang perlu saya pakai dan bawa?", "What should I wear and bring?"],
    a: [
      "Pakaian longgar yang menutup aurat, atau baju silat jika ada, dan berkaki ayam di atas tikar. Bawa air dan tuala. Bengkung diberikan apabila anda lulus gred pertama.",
      "Loose clothing covering the aurat, or baju silat if you have one, and bare feet on the mat. Bring water and a towel. Sashes are given when you pass your first grading.",
    ],
  },
  {
    q: ["Bolehkah bukan Islam menyertai?", "Can non-Muslims join?"],
    a: [
      "Kelas diadakan di masjid dan termasuk doa, tetapi silat ialah warisan Singapura yang terbuka kepada semua. Bukan Islam dialu-alukan jika mengikut adab dan etika pakaian masjid.",
      "Classes are held in mosques and include doa, but silat is Singapore heritage open to all. Non-Muslims are welcome if they follow mosque etiquette and dress code.",
    ],
  },
];

export function faqApproved() {
  return process.env.FAQ_APPROVED === "1";
}
