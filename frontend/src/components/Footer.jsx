import React from 'react';
import {
    Package, Facebook, Twitter, Linkedin, Instagram,
    Mail, Phone, MapPin, MessageCircle
} from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-white border-t border-gray-200 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">

                    {/* COLUMN 1: Brand & Socials */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-emerald-600 mb-2">
                            <Package className="w-8 h-8" />
                            <span className="text-2xl font-bold tracking-tight">Anantamart</span>
                        </div>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            India's leading B2B wholesale platform. We connect retailers with verified manufacturers to source genuine products at best prices.
                        </p>
                        <div className="flex gap-4 pt-4">
                            <SocialIcon Icon={Instagram} />
                            <SocialIcon Icon={Twitter} />
                            <SocialIcon Icon={Linkedin} />
                            <SocialIcon Icon={Facebook} />
                        </div>
                        <div className="pt-4 text-xs text-gray-400">
                            © 2026 Ananta Mart Pvt Ltd
                        </div>
                    </div>

                    {/* COLUMN 2: Company Links */}
                    <div>
                        <h3 className="font-bold text-gray-800 mb-4 text-base">Company</h3>
                        <ul className="space-y-3 text-sm text-gray-500">
                            <li><a href="#" className="hover:text-emerald-600 transition-colors">About Us</a></li>
                            <li><a href="#" className="hover:text-emerald-600 transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-emerald-600 transition-colors">Press & Media</a></li>
                            <li><a href="#" className="hover:text-emerald-600 transition-colors">Anantamart Blog</a></li>
                            <li><a href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</a></li>
                        </ul>
                    </div>

                    {/* COLUMN 3: Contact & Help */}
                    <div>
                        <h3 className="font-bold text-gray-800 mb-4 text-base">Contact Us</h3>
                        <ul className="space-y-4 text-sm text-gray-500">
                            <li className="flex items-start gap-3">
                                <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <a href="mailto:ayush458pandey@gmail.com" className="hover:text-emerald-600 transition-colors">
                                    ayush458pandey@gmail.com
                                </a>
                            </li>
                            <li className="flex items-start gap-3">
                                <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <span>+91 6291467226</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <MessageCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <a
                                    href="https://wa.me/916291467226"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-emerald-600 transition-colors"
                                >
                                    Chat on WhatsApp
                                </a>
                            </li>
                            <li className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <span>
                                    12th Floor, Tech Park,<br />
                                    Sector 5, Salt Lake,<br />
                                    Kolkata, WB - 700091
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* COLUMN 4: Download App */}
                    <div>
                        <h3 className="font-bold text-gray-800 mb-4 text-base">Download App</h3>
                        <p className="text-sm text-gray-500 mb-4">Get the full wholesale experience on your mobile.</p>
                        <div className="space-y-3">
                            {/* Google Play Button */}
                            <button className="flex items-center gap-3 bg-black text-white px-4 py-2.5 rounded-lg w-full sm:w-auto hover:bg-gray-800 transition-all shadow-sm hover:shadow-md">
                                <div className="text-2xl">▶</div>
                                <div className="text-left">
                                    <div className="text-[10px] uppercase font-medium tracking-wide opacity-80">Get it on</div>
                                    <div className="text-sm font-bold leading-none">Google Play</div>
                                </div>
                            </button>

                            {/* App Store Button */}
                            <button className="flex items-center gap-3 bg-black text-white px-4 py-2.5 rounded-lg w-full sm:w-auto hover:bg-gray-800 transition-all shadow-sm hover:shadow-md">
                                <div className="text-2xl"></div>
                                <div className="text-left">
                                    <div className="text-[10px] uppercase font-medium tracking-wide opacity-80">Download on the</div>
                                    <div className="text-sm font-bold leading-none">App Store</div>
                                </div>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </footer>
    );
};

// Small helper for social icons
const SocialIcon = ({ Icon }) => (
    <a href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">
        <Icon className="w-5 h-5" />
    </a>
);

export default Footer;