import React from 'react';
import Layout from '../components/layout/Layout';
import PricingCards from '../components/PricingCards';

export default function Pricing() {
  return (
    <Layout>
      <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
        <div className="max-w-6xl mx-auto pt-10">
          <PricingCards hideHeader={false} />
        </div>
      </div>
    </Layout>
  );
}
