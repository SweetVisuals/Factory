import React from 'react';
import Layout from '../components/layout/Layout';

const PrivacyPolicy = () => {
    return (
        <Layout hideFooterVisually={true}>
            <div className="max-w-4xl mx-auto px-6 py-12 text-foreground">
                <h1 className="text-3xl font-black mb-6">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>
                
                <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">1. Introduction</h2>
                        <p>
                            We respect your privacy and are committed to protecting it through our compliance with this policy. This Privacy Policy describes the types of information we may collect from you or that you may provide when you use our platform ("Relay Solutions" or the "Service") and our practices for collecting, using, maintaining, protecting, and disclosing that information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">2. Information We Collect</h2>
                        <ul className="list-disc pl-6 space-y-2 mb-4">
                            <li><strong>Account Information:</strong> We collect your email address, password (encrypted), and other account details when you register for the Service.</li>
                            <li><strong>User Content:</strong> Data, emails, leads, and campaigns you upload or create using the Service.</li>
                            <li><strong>Usage Data:</strong> Information about how you use our platform, including IP addresses, browser types, and usage patterns to help us improve the Service.</li>
                            <li><strong>Public Data:</strong> Our platform provides tools to aggregate publicly available data from the internet. We act as a service provider/processor for this data.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">3. How We Use Your Information</h2>
                        <p className="mb-4">We use information that we collect about you or that you provide to us:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>To provide, maintain, and improve our Service.</li>
                            <li>To fulfill any other purpose for which you provide it.</li>
                            <li>To carry out our obligations and enforce our rights arising from any contracts entered into between you and us, including for billing and collection.</li>
                            <li>To protect against, identify, and prevent fraud and other illegal activities.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">4. Disclosure of Your Information</h2>
                        <p>
                            We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties except as necessary to provide the Service (e.g., hosting providers, database services like Supabase). We may also release information when its release is appropriate to comply with the law, enforce our site policies, or protect ours or others' rights, property, or safety.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">5. Data Processing and Your Responsibilities</h2>
                        <p>
                            When using our scraping and outreach tools, you act as the Data Controller, and we act as the Data Processor. You are strictly responsible for ensuring you have a lawful basis to process the personal data of any leads or contacts you scrape or import, and for complying with all relevant data privacy regulations (e.g., GDPR, CCPA, PECR) in your communications with them.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">6. Security</h2>
                        <p>
                            We have implemented measures designed to secure your personal information from accidental loss and from unauthorized access, use, alteration, and disclosure. However, the transmission of information via the internet is not completely secure. We cannot guarantee the security of your personal information transmitted to our Service. Any transmission of personal information is at your own risk.
                        </p>
                    </section>
                </div>
            </div>
        </Layout>
    );
};

export default PrivacyPolicy;
