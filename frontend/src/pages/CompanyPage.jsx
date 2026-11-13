import React from 'react';
import { Link } from 'react-router-dom';

const pages = {
  about: {
    title: 'About Us',
    subtitle: 'A central B2B wholesale platform for everyday business buying.',
    sections: [
      ['Who We Are', 'Ananta Mart is a B2B wholesale platform where you can buy all kinds of products at competitive prices. We source products from importers, wholesalers, distributors, and manufacturers, then sell directly through one simple online catalog.'],
      ['What We Do', 'We help businesses discover products, compare options, prepare price estimates, and place orders without the usual back-and-forth of offline wholesale buying.'],
      ['Our Focus', 'Our focus is practical: wide product availability, fair pricing, clear order details, and reliable support from enquiry to delivery.'],
    ],
  },
  careers: {
    title: 'Careers',
    subtitle: 'Build the future of B2B wholesale with Ananta Mart.',
    sections: [
      ['Work With Us', 'We are growing Ananta Mart step by step and welcome people who care about operations, customer service, sourcing, technology, and sales.'],
      ['Current Openings', 'We do not have public openings listed right now. If you are interested in working with us, contact us with your details and area of interest.'],
      ['Contact', 'Email your profile to ayush458pandey@gmail.com and mention the role or work area you are interested in.'],
    ],
  },
  press: {
    title: 'Press & Media',
    subtitle: 'Official information and media contact for Ananta Mart.',
    sections: [
      ['Company Summary', 'Ananta Mart is a B2B wholesale platform focused on making product sourcing and wholesale ordering simpler through an online catalog and estimate-based buying flow.'],
      ['Media Enquiries', 'For press, partnership, or media enquiries, contact us at ayush458pandey@gmail.com.'],
    ],
  },
  blog: {
    title: 'Anantamart Blog',
    subtitle: 'Updates, buying tips, and wholesale business notes.',
    sections: [
      ['Coming Soon', 'We are preparing useful posts about product sourcing, wholesale buying, order planning, and running a better retail or distribution business.'],
      ['What To Expect', 'Future posts will cover product selection, pricing, seasonal demand, category updates, and practical business buying guides.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How Ananta Mart handles your information.',
    sections: [
      ['Information We Collect', 'We may collect your name, phone number, email address, business details, delivery address, order details, and payment-related information needed to provide our services.'],
      ['How We Use Information', 'We use your information to manage accounts, process carts and orders, coordinate delivery, provide support, improve our platform, and comply with legal or payment requirements.'],
      ['Data Sharing', 'We do not sell your personal information. We may share required details with payment providers, delivery partners, service providers, or authorities where legally required.'],
      ['Contact', 'For privacy questions, contact us at ayush458pandey@gmail.com.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'Rules for using Ananta Mart.',
    sections: [
      ['Use Of Platform', 'By using Ananta Mart, you agree to provide accurate account, order, billing, and delivery information. You are responsible for activity under your account.'],
      ['Orders And Pricing', 'Product availability, prices, taxes, delivery charges, and order acceptance may vary. Final order details are confirmed during checkout or order processing.'],
      ['Payments And Delivery', 'Payments may be processed through supported payment methods. Delivery timelines are estimates and may vary based on product availability, location, and logistics conditions.'],
      ['Support', 'For order or service questions, contact us through email, phone, or WhatsApp using the contact details on this website.'],
    ],
  },
};

export default function CompanyPage({ page = 'about' }) {
  const content = pages[page] || pages.about;

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
          Back to catalog
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">{content.title}</h1>
        <p className="text-base sm:text-lg text-gray-600 mt-3">{content.subtitle}</p>
      </div>

      <div className="space-y-6">
        {content.sections.map(([heading, body]) => (
          <section key={heading} className="bg-white border border-gray-100 rounded-lg p-5 sm:p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{heading}</h2>
            <p className="text-sm sm:text-base leading-relaxed text-gray-600">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
