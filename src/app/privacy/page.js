'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <div 
        className="relative py-20"
        style={{
          backgroundImage: "linear-gradient(rgba(0, 63, 136, 0.8), rgba(0, 83, 166, 0.9)), url('/mosaic-banner.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            We're committed to protecting your privacy and ensuring the security of your personal information.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="custom-prose">
            <p className="mb-6">
              NijaHomzs privacy notice provides information on how NijaHomzs and any of its subsidiaries collect, use, secure, transfer and share your information. NijaHomzs and its affiliates are a leading provider of Residential property surveys and valuations including facilities and project management.
            </p>
            <p className="mb-10">
              NijaHomzs has its head office in Lagos.
              Full details can be found on our website: http://www.NijaHomzs.com
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">How we collect information</h2>
            <p className="mb-4">
              Types of Information Collected. Typically, In the general conduct of business, NijaHomzs collects information relevant to the services being sought:
            </p>
            <p className="mb-4">
              Through consent to third parties disclosing information about you to us that they have collected. Such information will generally be collected directly via the use of any of our standard forms, over the Internet, via email, or through a telephone conversation with you. We may also collect personal information from our affiliates or suppliers. In addition, you may choose to submit information directly to us via NijaHomzs and affiliate websites; In response to marketing or other communications; social media; In connection with an actual or potential business or employment relationship with us.
            </p>
            <p className="mb-10">
              You may also agree with third parties disclosing information about you to us that those third parties have collected. We, our service providers, and partners collect certain information by using automated means, such as cookies and web beacons, when you interact with our advertisements and mobile applications, or visit our websites, pages, or other digital assets. The information we collect in this manner may include IP address, browser type, operating system, referring URLs and information on actions taken or interaction with our digital assets. We may use third-party web analytics services on our websites and mobile apps. The analytics providers that administer these services use technologies such as cookies and web beacons to help us analyse how visitors use our websites and apps.
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">Your Rights and Choices</h2>
            <p className="mb-10">
              This section specifies your ability, to opt out or limit the usage of the information collected.
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">Purposes of Collection</h2>
            <p className="mb-2">
              Generally, we will collect, use, and hold your information for:
            </p>
            <ul className="list-disc pl-8 mb-10 space-y-1">
              <li>Assessing your business details and services.</li>
              <li>Conducting business and developing relationships with NijaHomzs and affiliates.</li>
              <li>Process payments/transactions including Accounting, Authorisation, Auditing, Billing, Reconciliation, Complaints, Enquiries, etc.</li>
              <li>Protect against and prevent fraud, money laundering, and tax evasion, and manage compliance and security of business processes.</li>
              <li>Provide, administer, and communicate with you about NijaHomzs services, offers, and partners.</li>
              <li>Compile business directories, including business contact information.</li>
              <li>Operate, monitor, evaluate and improve our services, websites, mobile applications, other digital assets, and business.</li>
              <li>Developing new products and services.</li>
              <li>The functionality of our websites, mobile applications other digital assets.</li>
              <li>Enforce NijaHomzs "Terms of Use/Engagement", and other legal rights as may be required by applicable laws and regulations or requested by any judicial process or governmental agency having or claiming jurisdiction over NijaHomzs or its affiliates.</li>
              <li>Comply with industry standards and NijaHomzs policies Anti-Money Laundering policy.</li>
            </ul>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">The lawful basis for processing</h2>
            <p className="mb-2">
              NijaHomzs processes your information under the following:
            </p>
            <ul className="list-disc pl-8 mb-10 space-y-1">
              <li><strong>Performance of a contract:</strong> When you enter into a contract with NijaHomzs, we need to process your information as part of this contract.</li>
              <li><strong>Legitimate interests:</strong> some information is processed by NijaHomzs as part of its legitimate interests which include Fraud, risk assessment, due diligence, network and information security, suppressions and managing the opting out of communications, direct marketing, monitoring, web analytics, cloud storage, updating customer details, and other core services.</li>
              <li><strong>Consent:</strong> where we process information under consent, we will seek your unambiguous consent before processing your data.</li>
            </ul>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">Information We Share</h2>
            <p className="mb-4">
              We do not sell or otherwise disclose personal information we collect about you, except as described in this Privacy Notice or as indicated via the consent process at the time the data is collected.
            </p>
            <p className="mb-4">
              We share the information we collect with, but are not limited to:
            </p>
            <ul className="list-disc pl-8 mb-4 space-y-1">
              <li>Facilitation to provide required services, such as insurance coverage etc.</li>
              <li>We formally contracted service providers to perform services on our behalf.</li>
              <li>Hosting data centres, Infrastructure, Applications (Development/Support), Cloud Services, etc.</li>
            </ul>
            <p className="mb-4">
              Additionally, we may share information about you, if required legally, to prevent harm or financial / reputation loss, for investigation of suspected or actual fraudulent or illegal activities. Prospective employers requesting references via your written consent.
            </p>
            <p className="mb-4">
              On websites, features can be accessed where we partner with other entities that are not affiliated with NijaHomzs. These include social networking, etc. operated by third parties who may use or share personal information in accordance with their privacy policies. It is recommended that you review the third-party privacy policies if you use the relevant features.
            </p>
            <p className="mb-10">
              NijaHomzs reserve the right to transfer your information in the event of a sale or transfer (wholly or partially) of our business or assets, with reasonable efforts for the acquirer to protect/use your information consistent with our Global Privacy Notice. You can exercise your rights to contact the acquiring entity with questions concerning the protection and processing of your information.
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">How long do we keep information?</h2>
            <p className="mb-10">
              We will keep information for a reasonable amount of time to perform the purposes listed above. We only keep your information for as long as necessary. We generally keep personal information for up to 7 years after the last contact with you. However, NijaHomzs reserves the right to keep information for longer if we feel that this is in the legitimate interests of NijaHomzs.
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">International Data Transfers</h2>
            <p className="mb-10">
              NijaHomzs may transfer the personal information collected about you to recipients in countries other than the country in which the information was originally collected. Those countries may not have the same data protection laws as the country in which you initially provided the information. When we transfer your information to other countries, we will protect that information as described in this Privacy Notice or as otherwise disclosed to you at the time the data is collected (e.g. via program-specific privacy notice).
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">Profiling</h2>
            <p className="mb-4">
              Indirect profiling via anonymization of personal information is also used for preparing and furnishing aggregated data reports showing anonymised information, including, but not limited to, the following:
            </p>
            <ul className="list-disc pl-8 mb-10 space-y-1">
              <li>Compilations, analyses, analytical and predictive models and rules, and other aggregated reports to advise our partners/affiliates and service institutions and customers regarding past and potential future patterns of spending, fraud, and other insights that may be extracted from this data.</li>
              <li>Compiling and communicating promotional and marketing information about products and services that NijaHomzs and other organisations that we have affiliations with and that may be of interest to you.</li>
              <li>Conducting market research</li>
              <li>Facilitating our internal business operations, including the fulfilment of any legal requirements.</li>
            </ul>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">Your Rights and Choices</h2>
            <p className="mb-4">
              Your rights regarding the sensitive/personal information we maintain about you enable you to exercise choices about what personal information we collect from you, how we use that information, and how we communicate with you.
            </p>
            <p className="mb-4">
              You may have the right to:
            </p>
            <ul className="list-disc pl-8 mb-4 space-y-1">
              <li>Obtain confirmation that we hold personal information about you.</li>
              <li>Request access to and receive information about the personal information we maintain about you.</li>
              <li>Receive copies of the personal information we maintain about you.</li>
            </ul>
            <p className="mb-10">
              The right to access personal information may be limited in some circumstances by local law requirements. To exercise these rights, please contact us as set forth below: <a href="mailto:contact@NijaHomzs.com" className="text-blue-600 hover:underline">contact@NijaHomzs.com</a>
            </p>
            
            <h3 className="text-xl font-bold text-blue-800 mb-3 mt-8">Update and correct inaccuracies in your personal information:</h3>
            <p className="mb-8">
              If you feel that the information, we hold about you is incorrect you can contact us outlining the information you feel is incorrect. If we refuse to correct your personal information, we will provide you with a written notice that sets out the reasons for our refusal (unless it would be unreasonable to provide those reasons) and provide you with a statement regarding the mechanisms available to you to make a complaint. We will provide you with access to the information we hold about you.
            </p>
            
            <h3 className="text-xl font-bold text-blue-800 mb-3 mt-8">Object to the processing of your personal information:</h3>
            <p className="mb-8">
              If you would like to object to any processing of your information by NijaHomzs, you can contact us outlining what processing of the information you would like to object to: <a href="mailto:contact@NijaHomzs.com" className="text-blue-600 hover:underline">contact@NijaHomzs.com</a>. Have the information blocked, anonymised, or deleted:
              If you would like NijaHomzs to delete, block or anonymise information we hold about you, you can contact us outlining what information you would like deleted, blocked, or anonymised. To update your preferences, ask us to remove your information from our mailing lists or submit a request to access, update, correct or delete your personal information, please contact us as specified in the "How to Contact Us" section below.
            </p>
            
            <h3 className="text-xl font-bold text-blue-800 mb-3 mt-8">Opting out of processing</h3>
            <p className="mb-8">
              You can opt out of the collection of personal information by automated means e.g., when visiting our website or visiting third-party websites and interacting with our adverts, by using the Cookie Consent tool displayed on the website (the browser you use may provide options on how to opt out of receiving certain types of cookies). However, without cookies, you may not be able to use all the website features and/or online services. NijaHomzs operate a cookie policy. Some of our service providers and partners may collect information about your online activities over time and across third-party websites to customise and target our adverts. You can at any time tell us not to send you marketing communications by: <a href="mailto:contact@NijaHomzs.com" className="text-blue-600 hover:underline">contact@NijaHomzs.com</a>
              unsubscribing via the "unsubscribe link" within the marketing e-mails you receive from us, or contacting NijaHomzs as indicated below: <a href="mailto:contact@NijaHomzs.com" className="text-blue-600 hover:underline">contact@NijaHomzs.com</a>
            </p>
            
            <h3 className="text-xl font-bold text-blue-800 mb-3 mt-8">Withdrawal of consent</h3>
            <p className="mb-4">
              If we obtain your information by consent, you have the right to withdraw any consent you previously provided to us. If we process your information under legitimate interest, you can object at any time on legitimate grounds, to the processing of your personal information. NijaHomzs will apply your preferences going forward. Doing so will mean that you cannot take advantage of certain NijaHomzs and affiliate products, services, and promotions. The right to consent removal may be limited in some circumstances by local law requirements and you will be informed appropriately.
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">How to Contact Us / Complaints and Feedback</h2>
            <p className="mb-2">
              If you have any questions, please contact us: <a href="mailto:contact@NijaHomzs.com" className="text-blue-600 hover:underline">contact@NijaHomzs.com</a>
            </p>
            <p className="mb-4">
              Make a complaint about a breach of your personal information, applicable privacy laws/principles or a concern about NijaHomz's privacy practices.
            </p>
            <p className="mb-10">
              If we fall short of your expectations in processing your personal information or you wish to make a complaint about our privacy practices, please contact us at: <a href="mailto:contact@NijaHomzs.com" className="text-blue-600 hover:underline">contact@NijaHomzs.com</a>. To assist us in responding to your request, please give full details of the issue. We attempt to review and respond to all complaints within a reasonable time. If we cannot for lawful reasons complete your request, we will explain this to you to the extent that we lawfully can.
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">How We Protect Personal Information</h2>
            <p className="mb-4">
              The security of your personal information is very important, and NijaHomzs is committed to protecting the information we collect. We maintain administrative, technical, and physical safeguards designed to protect the personal information you provide, or we collect against accidental, unlawful, or unauthorised destruction, loss, alteration, access, disclosure, or use. We use SSL encryption on our websites from which we transfer certain personal information.
            </p>
            <p className="mb-10">
              NijaHomzs stores personal information only for as long as it is necessary for the fulfilment of the purpose for which the personal information was collected unless otherwise required or authorised by applicable law. We take measures to destroy or permanently de-identify personal information if required by law or if the personal information is no longer required for the purpose for which we collected it.
            </p>
            
            <h2 className="text-2xl font-bold text-blue-900 mb-4 mt-10">Updating this privacy statement</h2>
            <p className="mb-10">
              We will update this statement from time to time, so we suggest that you review this statement at regular intervals. Where we undergo substantial changes to our privacy statement, we will endeavor to inform you directly about these changes
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-12 bg-blue-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Have Questions About Our Privacy Policy?</h2>
          <p className="text-gray-700 mb-8">
            If you have any questions or concerns, we're here to help.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href="/terms"
              className="px-6 py-3 bg-white text-blue-600 border border-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Terms of Service
            </Link>
          </div>
        </div>
      </div>

      {/* Add custom CSS to override default prose styles */}
      <style jsx global>{`
        .custom-prose {
          
          margin: 0 auto;
          color: #374151;
          line-height: 1.7;
        }
        
        .custom-prose h2 {
          letter-spacing: -0.025em;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }
        
        .custom-prose h3 {
          letter-spacing: -0.025em;
        }
        
        .custom-prose a {
          text-decoration: none;
          font-weight: 500;
        }
        
        .custom-prose a:hover {
          text-decoration: underline;
        }
        
        .custom-prose strong {
          font-weight: 600;
          color: #1e3a8a;
        }
        
        .custom-prose ul li {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        
        @media (max-width: 640px) {
          .custom-prose {
            font-size: 0.9375rem;
          }
        }
      `}</style>
    </div>
  );
}