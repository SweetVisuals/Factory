import React from 'react';
import Layout from '../components/layout/Layout';

const TermsOfService = () => {
    return (
        <Layout hideFooterVisually={true}>
            <div className="max-w-4xl mx-auto px-6 py-12 text-foreground">
                <h1 className="text-3xl font-black mb-6">Terms of Service</h1>
                <p className="text-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>
                
                <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">1. Acceptance of Terms</h2>
                        <p>
                            By accessing and using this platform ("Relay Solutions", "Service", or "Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. We reserve the right to update and change the Terms of Service at any time without notice.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">2. Description of Service</h2>
                        <p>
                            The Platform provides a suite of tools for business outreach, lead generation, and email automation. The Service is provided "AS IS" and on an "AS AVAILABLE" basis. We disclaim all warranties, express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">3. Use of the Service and Compliance with Laws</h2>
                        <p className="mb-4">
                            You are solely responsible for all data, information, text, and emails ("Content") that you upload, post, send, or otherwise transmit via the Service. You agree to use the Service in compliance with all applicable local, state, national, and international laws, rules, and regulations, including but not limited to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>The CAN-SPAM Act (US)</li>
                            <li>The General Data Protection Regulation (GDPR) (EU/UK)</li>
                            <li>The Privacy and Electronic Communications Regulations (PECR) (UK)</li>
                            <li>Any other applicable anti-spam or data privacy laws in your jurisdiction.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">4. Indemnification</h2>
                        <p>
                            You agree to indemnify, defend, and hold harmless the Platform, its creators, developers, owners, affiliates, officers, and employees from and against any and all claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys' fees) that such parties may incur as a result of or arising from your (or anyone using your account's) violation of these Terms, your misuse of the Service, your violation of any rights of any other person or entity, or your violation of any laws (including anti-spam or privacy laws).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">5. Limitation of Liability</h2>
                        <p>
                            In no event shall the Platform, its owners, developers, or affiliates be liable for any direct, indirect, incidental, special, consequential or exemplary damages, including but not limited to, damages for loss of profits, goodwill, use, data or other intangible losses (even if we have been advised of the possibility of such damages), resulting from: (i) the use or the inability to use the service; (ii) the cost of procurement of substitute goods and services; (iii) unauthorized access to or alteration of your transmissions or data; (iv) statements or conduct of any third party on the service; (v) or any other matter relating to the service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">6. Data Sourcing and Scraping</h2>
                        <p>
                            The Platform provides tools to aggregate publicly available data. You acknowledge that we do not own this data and we make no guarantees regarding its accuracy, completeness, or lawfulness for your intended use. You are solely responsible for determining whether you have the legal right to use, store, and contact the entities and individuals identified through the Service.
                        </p>
                    </section>
                    
                    <section>
                        <h2 className="text-xl font-bold text-foreground mb-4">7. Termination</h2>
                        <p>
                            We reserve the right to suspend or terminate your account and refuse any and all current or future use of the Service for any reason at any time. Such termination of the Service will result in the deactivation or deletion of your Account or your access to your Account.
                        </p>
                    </section>
                </div>
            </div>
        </Layout>
    );
};

export default TermsOfService;
