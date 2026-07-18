import Link from 'next/link';
import { AlertTriangle, BadgeCheck, BookOpen, CreditCard, HelpCircle, MessageCircle, ShieldCheck, UserPlus } from 'lucide-react';

const helpSections = [
  {
    title: 'Getting Started',
    icon: UserPlus,
    tone: 'blue',
    items: [
      'Create an account with your email and phone number.',
      'Use the dashboard to post property, marketplace, housemate, service, or noticeboard listings.',
      'Keep your listing title, price, location, and contact number accurate so buyers can reach you.'
    ]
  },
  {
    title: 'Listings & Claims',
    icon: BookOpen,
    tone: 'amber',
    items: [
      'If Nijahomzs imports your public advert, you may receive a claim link on WhatsApp.',
      'Claim links are time-limited and should only be used by the rightful advertiser.',
      'After claiming, you can edit the listing, add better photos, and manage buyer enquiries.'
    ]
  },
  {
    title: 'Verification & Trust',
    icon: ShieldCheck,
    tone: 'emerald',
    items: [
      'Agents can submit ID/CAC documents and verify their phone number from the dashboard.',
      'Approved users receive a verified badge across listing cards and detail pages.',
      'Rejected submissions show a reason and can be corrected/resubmitted.'
    ]
  },
  {
    title: 'Payments & Promotions',
    icon: CreditCard,
    tone: 'blue',
    items: [
      'Promote and advertising payments are handled through Flutterwave when paid plans are active.',
      'Introductory zero-fee promotions may log interest without charging the user.',
      'Never send payment details to anyone outside official Nijahomzs payment flows.'
    ]
  },
  {
    title: 'Safety & Fraud Reports',
    icon: AlertTriangle,
    tone: 'red',
    items: [
      'Use the Report button on listing pages if a listing is suspicious, offensive, unavailable, or incorrectly priced.',
      'Our admin team reviews reports and can resolve, dismiss, or escalate them.',
      'Avoid sharing OTPs, passwords, or sensitive documents directly with other users.'
    ]
  },
  {
    title: 'Support Channels',
    icon: MessageCircle,
    tone: 'emerald',
    items: [
      'Use the contact form for general support, complaints, partnerships, and technical issues.',
      'WhatsApp messages to the official Nijahomzs number are routed into the support inbox when connected.',
      'Technical issues can be escalated to the development team from the admin support dashboard.'
    ]
  }
];

const toneClasses = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600'
};

export const metadata = {
  title: 'Help Center | Nijahomzs',
  description: 'Nijahomzs help documentation for listings, verification, payments, safety, and customer support.'
};

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15">
            <HelpCircle className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold md:text-5xl">Nijahomzs Help Center</h1>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-white/85">
            Simple guidance for posting listings, verifying your account, reporting issues, and getting support from the Nijahomzs team.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {helpSections.map((section) => {
            const Icon = section.icon;
            return (
              <article key={section.title} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses[section.tone]}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-10 rounded-3xl border border-blue-100 bg-blue-50 p-6 text-center">
          <h2 className="text-2xl font-bold text-blue-900">Still need help?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-gray-700">
            Send us a support request and keep your ticket reference. The team can handle general queries, complaints, fraud reports, and technical escalations.
          </p>
          <Link href="/contact" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700">
            Contact Support
          </Link>
        </div>
      </section>
    </main>
  );
}
