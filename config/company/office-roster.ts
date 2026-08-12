/**
 * Office roster from:
 * - public/Address and mail.pdf (name, mobile, email, address)
 * - public/staffs & court details.pdf (default courts)
 *
 * Roles (locked):
 * - Senniappan → admin + advocate (Managing Partner)
 * - Ajith → sub_admin + advocate (Partner / manager)
 * - Thilagavathi → accountant
 * - Surya → sub_admin + advocate (HR Manager)
 */
import type { DefaultCourt } from "@/lib/hearings/court-key";

const TN = "Tamil Nadu";
const KA = "Karnataka";
const WB = "West Bengal";
const ER = "Erode";

function court(
  city: string,
  courtName: string,
  district = ER,
  state = TN
): DefaultCourt {
  return { state, district, city, courtName };
}

export type OfficeRosterRow = {
  name: string;
  designation: string;
  mobile: string;
  email?: string;
  address?: string;
  /** Extra roles beyond designation defaults. */
  forceRoles?: ("admin" | "sub_admin" | "advocate" | "staff" | "accountant")[];
  defaultCourts: DefaultCourt[];
};

export const OFFICE_ROSTER: OfficeRosterRow[] = [
  {
    name: "Senniappan M",
    designation: "Managing Partner",
    mobile: "9841578862",
    email: "Senniappan.m@gmail.com",
    address:
      "S/o.Munusamy.R, Door No.23, Periyar Illam, Dr.Ambedhkar street, Nambiyur-638458",
    forceRoles: ["admin", "advocate"],
    defaultCourts: [
      court("Gobichettipalayam", "District Munsif Court, Gobichettipalayam"),
    ],
  },
  {
    name: "Ajith A",
    designation: "Partner",
    mobile: "9786570408",
    email: "ajithbabl12347@gmail.com",
    address: "S/o.Avinashiappan, 34, Kamaraj Nagar, Nambiyur",
    forceRoles: ["sub_admin", "advocate"],
    defaultCourts: [
      court("Gobichettipalayam", "District Munsif Court, Gobichettipalayam"),
    ],
  },
  {
    name: "Thilagavathi P",
    designation: "Accountant",
    mobile: "9514078862",
    email: "Thilakallb8862@gmail.com",
    address:
      "D/o.Palanisamy, Door No.23, Periyar Illam, Dr.Ambedhkar street, Nambiyur-638458",
    forceRoles: ["accountant"],
    defaultCourts: [],
  },
  {
    name: "Surya M",
    designation: "HR Manager",
    mobile: "9578042348",
    email: "Suryamadhan090@gmail.com",
    address:
      "S/o.Madhan, Door no.320, Alathucombai Colony, Sathyamangalam-638401",
    forceRoles: ["sub_admin", "advocate"],
    defaultCourts: [
      court("Erode", "Principal District Court, Erode"),
      court("Erode", "Mahila Court, Erode"),
      court("Erode", "Principal District Munsif Court, Erode"),
      court("Erode", "Principal District Subordinate Court, Erode"),
      court("Erode", "Judicial Magistrate Court No.3, Erode"),
      court("Erode", "Family Court, Erode"),
      court("Erode", "Employee Compensation Court, Erode"),
      court(
        "Kollegal",
        "Judicial Magistrate Fastrack Court, Kollegal",
        "Chamarajanagara",
        KA
      ),
      court(
        "Bengaluru",
        "Additional Chief Judicial Magistrate Court, Bangalore",
        "Bengaluru Urban",
        KA
      ),
      court(
        "Kolkata",
        "Metropolitan Magistrate Court, Kolkata",
        "Kolkata",
        WB
      ),
      court("Chennai", "Chief Judicial Court, Chennai", "Chennai"),
    ],
  },
  {
    name: "Vairal G",
    designation: "Advocate",
    mobile: "8760228622",
    email: "vairalg18@gmail.com",
    address:
      "W/o.Sridhar, Door.No.8B/1, Kambar 1st street, Gobichettipalayam-638452",
    defaultCourts: [
      court(
        "Gobichettipalayam",
        "III-Additional District Sessions Court, Gobichettipalayam"
      ),
    ],
  },
  {
    name: "Subhakannan D",
    designation: "Advocate",
    mobile: "6379614984",
    email: "Kannansubha2002@gmail.com",
    address:
      "S/o.Devaraj, Door No.92/2, Vaikkal Medu, Kulampalayam, Gobichettipalayam-638476",
    defaultCourts: [
      court("Gobichettipalayam", "Subordinate Court, Gobichettipalayam"),
    ],
  },
  {
    name: "Dhineshkumar M",
    designation: "Advocate",
    mobile: "7708886866",
    email: "Dhineshkumarmahesh@gmail.com",
    address: "S/o.Makeswaran, Door No.28A, Kamaraj Nagar, Nambiyur-638458",
    defaultCourts: [
      court(
        "Gobichettipalayam",
        "Judicial Magistrate Court No.I, Gobichettipalayam"
      ),
    ],
  },
  {
    name: "Dhivyabharathi J",
    designation: "Advocate",
    mobile: "8056947288",
    email: "dhivyabharathijothimani@gmail.com",
    address:
      "D/o.Jothimani, Door No.2/8, Forester street, T.N.Palayam, Vaniputhur, Gobichettipalayam-638506",
    defaultCourts: [
      court(
        "Gobichettipalayam",
        "Judicial Magistrate Court No.II, Gobichettipalayam"
      ),
    ],
  },
  {
    name: "Sivabharathi T",
    designation: "Advocate",
    mobile: "9003485618",
    email: "Sivabharathithangaraj2001@gmail.com",
    address:
      "S/o.Thangaraj, Door No.179, Nanjappagoundanpudur, Konamoolai, Sathyamangalam-638402",
    defaultCourts: [
      court("Sathyamangalam", "District Munsif Court, Sathyamangalam"),
      court("Sathyamangalam", "Subordinate Court, Sathyamangalam"),
      court("Sathyamangalam", "Judicial Magistrate Court, Sathyamangalam"),
      court("Anthiyur", "District Munsif Court, Anthiyur"),
      court("Bhavani", "District Munsif Court, Bhavani"),
      court("Bhavani", "Subordinate Court, Bhavani"),
      court("Bhavani", "Judicial Magistrate Court No.1, Bhavani"),
      court("Bhavani", "Judicial Magistrate Court No.2, Bhavani"),
      court("Bhavani", "Additional District Sessions Court, Bhavani"),
      court("Perundurai", "District Munsif Court, Perundurai"),
      court("Perundurai", "Subordinate Court, Perundurai"),
      court("Perundurai", "Judicial Magistrate Court, Perundurai"),
    ],
  },
  {
    name: "Ezhilarasu T",
    designation: "Advocate",
    mobile: "7812858088",
    email: "Ezhilarasu4527@gmail.com",
    address:
      "S/o.Thangavel, Door No.9/151, IndiraNagar, Kongarpalayam, Gobichettipalayam-638506",
    defaultCourts: [
      court("Avinashi", "District Munsif Court, Avinashi", "Tiruppur"),
      court("Avinashi", "Subordinate Court, Avinashi", "Tiruppur"),
      court("Avinashi", "Judicial Magistrate Court, Avinashi", "Tiruppur"),
      court("Tiruppur", "Additional District Court, Tiruppur", "Tiruppur"),
      court("Tiruppur", "Principal District Munsif Court, Tiruppur", "Tiruppur"),
      court("Tiruppur", "Family Court, Tiruppur", "Tiruppur"),
      court("Tiruppur", "Special Tribunal Court, Tiruppur", "Tiruppur"),
      court("Palladam", "Subordinate Court, Palladam", "Tiruppur"),
      court("Palladam", "Judicial Magistrate Court, Palladam", "Tiruppur"),
      court("Uthukuli", "District Munsif Court, Uthukuli", "Tiruppur"),
      court("Kangeyam", "Subordinate Court, Kangeyam", "Tiruppur"),
    ],
  },
  {
    name: "Vignesh P",
    designation: "Advocate",
    mobile: "9345876657",
    email: "Vigneshp934587@gmail.com",
    address:
      "S/o.Perumal, Door No.9/34(2), Thempilikaruppan Street, Thempili colony, Gobichettipalayam-638503",
    defaultCourts: [
      court("Mettupalayam", "District Munsif Court, Mettupalayam", "Coimbatore"),
      court("Mettupalayam", "Subordinate Court, Mettupalayam", "Coimbatore"),
      court(
        "Mettupalayam",
        "Judicial Magistrate Court, Mettupalayam",
        "Coimbatore"
      ),
      court("Coimbatore", "Additional Subordinate Court, Coimbatore", "Coimbatore"),
      court(
        "Coimbatore",
        "Principal District Munsif Court, Coimbatore",
        "Coimbatore"
      ),
      court("Pollachi", "Judicial Magistrate Court, Pollachi", "Coimbatore"),
      court("Pollachi", "District Munsif Court, Pollachi", "Coimbatore"),
      court(
        "Komarapalayam",
        "Judicial Magistrate Court, Komarapalayam",
        "Namakkal"
      ),
      court(
        "Pappireddipatti",
        "Judicial Magistrate Court, Papirettipatti",
        "Dharmapuri"
      ),
      court("Mettur", "District Munsif Court, Mettur", "Salem"),
      court("Attur", "Subordinate Court, Attur", "Salem"),
      court("Omalur", "District Munsif Court, Omalur", "Salem"),
      court(
        "Tirunelveli",
        "Special Subordinate Court, Tirunelveli",
        "Tirunelveli"
      ),
      court(
        "Thanjavur",
        "Judicial Magistrate Court No.1, Thanjavur",
        "Thanjavur"
      ),
    ],
  },
  {
    name: "Karpagam C",
    designation: "Advocate",
    mobile: "6380956104",
    email: "Suryakarpagam88@gmail.com",
    address:
      "W/o.Suryaprakash, 28, Thiruvallur street, Alukkuli, Gobichettipalayam-638453",
    defaultCourts: [],
  },
  {
    name: "Elangovan A",
    designation: "Advocate",
    mobile: "8056755862",
    email: "Elangokavitha2002@gmail.com",
    address:
      "S/o.Arumugam, Door No.146A, Vinayakar Kovil Street, Vinayakapuram, Gobichettipalayam-638458",
    defaultCourts: [],
  },
  {
    name: "Saranya A",
    designation: "Advocate",
    mobile: "9597507853",
    email: "Saranbu7311@gmail.com",
    address:
      "W/o.Anbarasu, Door No.9, North Thottam, Kolappalur, Gobichettipalayam-638456",
    defaultCourts: [],
  },
  {
    name: "Matheswaran R",
    designation: "Clerk",
    mobile: "9842328723",
    email: "Matheswaran1958@gmail.com",
    address:
      "S/o.Late Rathinam, Door No.36A Kodeeswara nagar, Gobichettipalayam-638452",
    defaultCourts: [],
  },
  {
    name: "Vanaja D",
    designation: "Typist",
    mobile: "9245764933",
    email: "Dvanaja1976@gmail.com",
    address:
      "W/o.Dhanarajan, Door No.9/2.Subbunagar, Modachur (PO), Gobichettipalayam-638476",
    defaultCourts: [],
  },
  {
    name: "Dheetchana V",
    designation: "Office Executive",
    mobile: "6381586200",
    email: "Dheetchanadheetchana37@gmail.com",
    address:
      "D/o.Velumani, Door No.8/234, Indharanagar, Akkaraithathapalli, Uthandiyur-638402",
    defaultCourts: [],
  },
  {
    name: "Jeevanantham M",
    designation: "Driver",
    mobile: "8056454255",
    email: "Clmmahe1042@gmail.com",
    address:
      "S/o.Moorthi, Door No.2/100, Pattarai street, Gudakkarai, Nambiyur Taluk-638454",
    defaultCourts: [],
  },
];

export const OFFICE_ROSTER_MOBILES = new Set(
  OFFICE_ROSTER.map((r) => r.mobile)
);
