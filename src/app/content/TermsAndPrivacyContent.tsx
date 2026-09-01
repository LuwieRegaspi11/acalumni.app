// =====================================================================
// TERMS & PRIVACY CONTENT — single source of truth for the Terms of
// Service and Privacy Policy body. Rendered both by the standalone
// /terms page (TermsPage.tsx) and by the sign-up "read before you
// check the box" modal (shared/TermsModal.tsx). Edit the copy here —
// it stays in sync everywhere automatically. Mirrors
// docs/TERMS_AND_PRIVACY.md; keep the two in sync when either is edited.
// =====================================================================
import React from 'react';

export const NAVY = '#1B3A6B';
export const BLUE = '#2B5BA8';

export const LAST_UPDATED = 'August 26, 2026';

// Section anchor ids used to deep-link/scroll to a given part of the
// document (e.g. jumping straight to the Privacy Policy from the
// sign-up checkbox's "Privacy Policy" link).
export const TOS_ANCHOR = 'tos';
export const PRIVACY_ANCHOR = 'privacy';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-8 scroll-mt-24">
      <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>{title}</h3>
      <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

/**
 * The full Terms of Service + Privacy Policy body (headings, section
 * text, the data-sharing table, etc.) — no outer page chrome (no
 * header, back button, or card wrapper). The page and the modal each
 * supply their own surrounding layout.
 */
export default function TermsAndPrivacyContent() {
  return (
    <div>
      <p className="text-sm text-gray-600 leading-relaxed mb-8">
        Please read this document carefully before creating an account. By checking{' '}
        <span className="font-semibold">"I agree to the Terms &amp; Privacy Policy (RA 10173)"</span> on the
        registration page, you confirm that you have read, understood, and agree to be bound by the Terms of
        Service below and consent to the data practices described in the Privacy Policy that follows.
      </p>

      {/* ================= TERMS OF SERVICE ================= */}
      <h2 id={TOS_ANCHOR} className="text-lg font-bold mb-5 pb-2 border-b border-gray-100 scroll-mt-24" style={{ color: NAVY }}>
        Terms of Service
      </h2>

      <Section id="tos-1" title="1. Acceptance of Terms">
        <p>
          These Terms of Service ("Terms") govern your access to and use of the Asian College Alumni Tracer &amp;
          Donation System (the "Platform"), operated by Asian College (the "College," "we," "us," or "our"). By
          registering for an account, accessing, or using the Platform in any way, you agree to be bound by these
          Terms. If you do not agree, do not register for or use the Platform.
        </p>
      </Section>

      <Section id="tos-2" title="2. Eligibility">
        <p>Registration on the Platform is limited to the following user categories, each subject to verification by the College:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold text-gray-700">Alumni</span> — individuals who have graduated from or completed a program at Asian College.</li>
          <li><span className="font-semibold text-gray-700">Faculty</span> — current or former faculty and staff members authorized to support alumni engagement within their department.</li>
          <li><span className="font-semibold text-gray-700">Batch Representatives</span> — alumni designated to coordinate communication and activities for a specific batch year.</li>
          <li><span className="font-semibold text-gray-700">Administrators</span> — College personnel authorized to manage the Platform, verify accounts, and oversee donations and records.</li>
        </ul>
        <p>The College reserves the right to request supporting documentation (such as a valid ID or proof of graduation) to confirm eligibility for any of the above categories, and to deny or revoke registration where eligibility cannot be reasonably established.</p>
      </Section>

      <Section id="tos-3" title="3. Account Responsibilities">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must provide accurate, current, and complete information during registration, including your name, contact details, department, and batch year, and keep this information up to date.</li>
          <li>You must upload a valid, legible government-issued or school-issued ID for identity verification. Accounts may remain restricted or pending until ID verification is completed by an administrator.</li>
          <li>Only <span className="font-semibold text-gray-700">one account per person</span> is permitted. Creating multiple accounts, impersonating another individual, or registering under a false identity is prohibited and grounds for suspension.</li>
          <li>You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately if you suspect unauthorized access.</li>
        </ul>
      </Section>

      <Section id="tos-4" title="4. Acceptable Use">
        <p>When using the Platform, you agree that you will <span className="font-semibold text-gray-700">not</span>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Submit fraudulent, reversed, or falsified donation transactions, or attempt to manipulate donation records or reports.</li>
          <li>Use the alumni directory, contact information, or communication tools to send unsolicited commercial messages, harassment, spam, or for any purpose unrelated to legitimate alumni engagement.</li>
          <li>Scrape, export, or redistribute alumni personal data obtained through the Platform to third parties without authorization.</li>
          <li>Upload false identification documents or misrepresent your identity, department, or batch affiliation.</li>
          <li>Attempt to gain unauthorized access to accounts, data, or system functions beyond your assigned role/permissions.</li>
          <li>Use the Platform for any unlawful purpose or in violation of applicable Philippine laws.</li>
        </ul>
        <p>Violation of this section may result in immediate suspension or termination of your account, without prejudice to any legal remedies available to the College or affected parties.</p>
      </Section>

      <Section id="tos-5" title="5. Donations">
        <ul className="list-disc pl-5 space-y-2">
          <li>Donations made through the Platform are processed via the payment methods and channels designated by the College at the time of transaction.</li>
          <li>All donations are recorded and associated with the donating alumnus/alumna's account for transparency and reporting purposes, unless made anonymously where such an option is offered.</li>
          <li><span className="font-semibold text-gray-700">Refunds and disputes:</span> Requests to reverse, refund, or dispute a donation must be submitted to the College's finance/alumni relations office within a reasonable period from the transaction date. Refunds are granted only in cases of verified processing error, duplicate transaction, or unauthorized use, and are subject to the College's discretion and applicable payment processor policies.</li>
          <li><span className="font-semibold text-gray-700">Transparency reporting:</span> Aggregate donation data (e.g., total funds raised per campaign, batch, or purpose) may be published or shared with the alumni community for accountability. Individual donation amounts will not be publicly disclosed without the donor's consent, except where legally required or where the donor has opted into public recognition (e.g., a donor wall or acknowledgment list).</li>
        </ul>
      </Section>

      <Section id="tos-6" title="6. Content & Conduct">
        <p>Users who post announcements, job board listings, or survey responses agree that such content will:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Be truthful, relevant to the alumni community, and free of misleading claims (particularly for job postings).</li>
          <li>Not contain hate speech, discriminatory content, harassment, defamatory statements, or material that infringes on the rights of others.</li>
          <li>Not be used to advertise unrelated commercial products/services, scams, or multi-level marketing schemes.</li>
          <li>Comply with all applicable laws, including intellectual property and data privacy laws.</li>
        </ul>
        <p>The College reserves the right to review, edit, or remove any posted content (announcements, job listings, survey responses, or comments) that violates these standards, without prior notice.</p>
      </Section>

      <Section id="tos-7" title="7. Account Suspension/Termination">
        <p>The College, through its administrators, may suspend, restrict, or terminate an account, with or without prior notice, on grounds including but not limited to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Failure to complete or pass ID verification, or submission of fraudulent identification.</li>
          <li>Violation of the Acceptable Use or Content &amp; Conduct provisions above.</li>
          <li>Fraudulent donation activity or misuse of financial features.</li>
          <li>Creation of duplicate accounts or impersonation of another individual.</li>
          <li>Extended inactivity, at the College's discretion, where necessary for records management.</li>
          <li>Any other conduct that the College reasonably determines to be harmful to the Platform, its users, or the institution's reputation.</li>
        </ul>
        <p>Users may appeal a suspension or termination by contacting the Alumni Relations Office or the Data Protection Officer (see contact details below).</p>
      </Section>

      <Section id="tos-8" title="8. Limitation of Liability">
        <p>The Platform is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, Asian College and its officers, employees, and agents shall not be liable for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Any indirect, incidental, special, or consequential damages arising from your use of, or inability to use, the Platform.</li>
          <li>Errors, interruptions, delays, or data loss resulting from technical issues, third-party payment processors, or events beyond the College's reasonable control.</li>
          <li>Actions taken by other users, including misuse of information shared through the alumni directory or job board.</li>
        </ul>
        <p>Nothing in this section limits any liability that cannot be excluded under Philippine law, including obligations under the Data Privacy Act of 2012.</p>
      </Section>

      <Section id="tos-9" title="9. Changes to Terms">
        <p>
          We may revise these Terms from time to time to reflect changes in the Platform's functionality, legal
          requirements, or institutional policy. Material changes will be communicated through the Platform (e.g., a
          notice upon login) or via the email address on file. Continued use of the Platform after such changes
          take effect constitutes acceptance of the revised Terms. We encourage you to review this page periodically.
        </p>
      </Section>

      {/* ================= PRIVACY POLICY ================= */}
      <h2 id={PRIVACY_ANCHOR} className="text-lg font-bold mt-10 mb-1 pb-2 border-b border-gray-100 scroll-mt-24" style={{ color: NAVY }}>
        Privacy Policy
      </h2>
      <p className="text-xs text-gray-400 italic mb-5">
        Compliant with Republic Act No. 10173, the Data Privacy Act of 2012, and its Implementing Rules and Regulations.
      </p>

      <p className="text-sm text-gray-600 leading-relaxed mb-6">
        Asian College is committed to protecting the privacy and security of personal data entrusted to it by
        alumni, faculty, and other users of the Platform. This Privacy Policy explains what data we collect, why
        we collect it, how it is used and protected, and what rights you have over your information.
      </p>

      <Section id="pp-1" title="1. What Data Is Collected">
        <p>Through your use of the Platform, we may collect and process the following categories of personal data:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold text-gray-700">Identity and contact information:</span> full name, email address, home/mailing address, phone number.</li>
          <li><span className="font-semibold text-gray-700">Academic/affiliation information:</span> department/program, batch year, and role (alumni, faculty, batch representative, administrator).</li>
          <li><span className="font-semibold text-gray-700">Identity verification documents:</span> an uploaded photo or scan of a valid ID, used solely to confirm your identity and eligibility.</li>
          <li><span className="font-semibold text-gray-700">Donation history:</span> records of donations made through the Platform, including amount, date, campaign/purpose, and payment reference (excluding full payment card/account details, which are handled by our payment processor).</li>
          <li><span className="font-semibold text-gray-700">Survey and tracer study responses:</span> answers submitted to alumni tracer studies, employment surveys, or other institutional surveys.</li>
          <li><span className="font-semibold text-gray-700">Usage data:</span> login activity and account status information necessary for system administration and security.</li>
        </ul>
      </Section>

      <Section id="pp-2" title="2. Purpose of Collection">
        <p>Your personal data is collected and processed for the following purposes:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold text-gray-700">Alumni verification</span> — confirming your identity, graduation status, and eligibility to register on the Platform.</li>
          <li><span className="font-semibold text-gray-700">Tracer studies</span> — conducting alumni tracer studies and employment surveys required for institutional accreditation, academic program review, and reporting to relevant education authorities (e.g., CHED).</li>
          <li><span className="font-semibold text-gray-700">Donation processing</span> — recording, processing, and reporting on donations made to the College, and issuing acknowledgments or receipts.</li>
          <li><span className="font-semibold text-gray-700">Event and batch communication</span> — sending updates, invitations, and announcements relevant to your batch, department, or alumni community, and enabling batch representatives to coordinate with their batch.</li>
          <li><span className="font-semibold text-gray-700">Platform administration and security</span> — managing accounts, enforcing these Terms, and maintaining the integrity and security of the system.</li>
        </ul>
      </Section>

      <Section id="pp-3" title="3. Legal Basis for Processing">
        <p>We process your personal data on the following legal bases under RA 10173:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold text-gray-700">Consent</span> — you provide explicit consent to the collection and processing of your personal data, including your uploaded ID, by registering and agreeing to this Privacy Policy.</li>
          <li><span className="font-semibold text-gray-700">Legitimate interest of the institution</span> — certain processing (e.g., maintaining alumni records, conducting tracer studies for accreditation purposes, and fraud prevention in donation processing) is carried out in pursuit of the College's legitimate institutional interests, balanced against your fundamental rights and freedoms.</li>
        </ul>
        <p>Where applicable, processing may also be based on <span className="font-semibold text-gray-700">compliance with a legal obligation</span> (e.g., reporting requirements to CHED or other government agencies) or <span className="font-semibold text-gray-700">performance of a contract</span> (e.g., processing a donation transaction you initiate).</p>
      </Section>

      <Section id="pp-4" title="4. Data Sharing — Who Can Access What">
        <p>Access to personal data within the Platform is restricted according to role, enforced through role-based access controls and database-level Row-Level Security (RLS) policies:</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-xs border-collapse mt-1">
            <thead>
              <tr className="text-left" style={{ background: '#EEF3FB' }}>
                <th className="p-2 rounded-l-lg font-bold" style={{ color: NAVY }}>Role</th>
                <th className="p-2 rounded-r-lg font-bold" style={{ color: NAVY }}>Access Scope</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-b border-gray-100">
                <td className="p-2 font-semibold text-gray-700 align-top whitespace-nowrap">Administrator</td>
                <td className="p-2 align-top">Full access to all alumni records, donation data, and survey responses, for verification, reporting, and system administration purposes.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="p-2 font-semibold text-gray-700 align-top whitespace-nowrap">Faculty</td>
                <td className="p-2 align-top">Access limited to alumni records within their own department only.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="p-2 font-semibold text-gray-700 align-top whitespace-nowrap">Batch Representative</td>
                <td className="p-2 align-top">Access limited to alumni records within their own assigned batch year only.</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold text-gray-700 align-top whitespace-nowrap">Alumni</td>
                <td className="p-2 align-top">Access limited to their own personal data and records; cannot view other alumni's personal information beyond what is intentionally made visible in the public/shared alumni directory (if any).</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          We do not sell your personal data. Data may be shared with third parties only in the following limited
          circumstances: (a) payment processors, strictly to complete donation transactions; (b) government
          agencies or accrediting bodies, where required by law or for tracer study reporting (typically in
          aggregated or de-identified form); or (c) service providers who process data on our behalf under
          confidentiality obligations (e.g., hosting/database providers), consistent with this Policy.
        </p>
      </Section>

      <Section id="pp-5" title="5. Data Retention Period">
        <p>Personal data is retained only for as long as necessary to fulfill the purposes described in this Policy, or as required by applicable law and institutional record-keeping policies:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold text-gray-700">Account and profile information</span> is retained for the duration of your account's active status and for a reasonable period thereafter to support alumni records continuity.</li>
          <li><span className="font-semibold text-gray-700">Uploaded ID documents</span> are retained only as long as necessary to complete identity verification and to resolve any disputes regarding account authenticity, after which they may be archived securely or deleted in accordance with the College's records retention schedule.</li>
          <li><span className="font-semibold text-gray-700">Donation records</span> are retained in accordance with applicable financial and audit record-keeping requirements (typically several years, as required by law).</li>
          <li><span className="font-semibold text-gray-700">Survey/tracer study responses</span> may be retained in aggregated or de-identified form indefinitely for institutional research and accreditation purposes.</li>
        </ul>
        <p>Upon account deletion or a valid erasure request, personal data will be removed or anonymized except where retention is required by law (e.g., financial records) or necessary to establish, exercise, or defend legal claims.</p>
      </Section>

      <Section id="pp-6" title="6. Data Subject Rights Under RA 10173">
        <p>As a data subject, you have the following rights under the Data Privacy Act of 2012:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold text-gray-700">Right to be informed</span> — to know how your personal data is being collected and processed (as described in this Policy).</li>
          <li><span className="font-semibold text-gray-700">Right to access</span> — to obtain a copy of the personal data we hold about you.</li>
          <li><span className="font-semibold text-gray-700">Right to correct (rectification)</span> — to request correction of inaccurate or outdated personal data.</li>
          <li><span className="font-semibold text-gray-700">Right to object</span> — to object to the processing of your personal data, including processing based on legitimate interest, subject to legal or contractual restrictions.</li>
          <li><span className="font-semibold text-gray-700">Right to erasure or blocking</span> — to request the deletion or blocking of your personal data under certain conditions (e.g., data is no longer necessary for the purpose collected, or consent has been withdrawn).</li>
          <li><span className="font-semibold text-gray-700">Right to data portability</span> — to obtain and reuse your personal data, in a commonly used electronic format, for your own purposes across different services.</li>
          <li><span className="font-semibold text-gray-700">Right to damages</span> — to be indemnified for damages sustained due to inaccurate, incomplete, outdated, false, unlawfully obtained, or unauthorized use of personal data.</li>
          <li><span className="font-semibold text-gray-700">Right to file a complaint</span> — to lodge a complaint with the <span className="font-semibold text-gray-700">National Privacy Commission (NPC)</span> if you believe your data privacy rights have been violated.</li>
        </ul>
        <p>To exercise any of these rights, please contact our Data Protection Officer using the details in Section 8 below.</p>
      </Section>

      <Section id="pp-7" title="7. Security Measures">
        <p>We implement appropriate organizational, physical, and technical security measures to protect your personal data, including:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="font-semibold text-gray-700">Encryption</span> of data in transit (via HTTPS/TLS) and, where applicable, at rest.</li>
          <li><span className="font-semibold text-gray-700">Access control</span> based on user roles, ensuring users can only view or modify data appropriate to their role (alumni, faculty, batch representative, administrator).</li>
          <li><span className="font-semibold text-gray-700">Row-Level Security (RLS) policies</span> enforced at the database level, restricting data queries so that each role can only retrieve records it is authorized to access — for example, faculty are restricted to their own department, and batch representatives to their own batch year.</li>
          <li><span className="font-semibold text-gray-700">Secure storage of uploaded ID documents</span>, with access limited to authorized personnel involved in the verification process.</li>
          <li>Regular review of access permissions and system configurations to identify and remediate security gaps.</li>
          <li>Internal policies governing staff access to and handling of personal data, including confidentiality obligations for administrators and faculty with elevated access.</li>
        </ul>
        <p>While we take reasonable measures to protect your data, no system can guarantee absolute security. We encourage you to safeguard your account credentials and to notify us immediately of any suspected unauthorized access.</p>
      </Section>

      <Section id="pp-8" title="8. Contact Information for the Data Protection Officer">
        <p>For questions, concerns, or requests relating to this Privacy Policy or the processing of your personal data, please contact:</p>
        <div className="rounded-xl p-4 border border-gray-100" style={{ background: '#F8FAFC' }}>
          <p className="font-semibold text-gray-700 mb-0.5">Data Protection Officer</p>
          <p>Asian College</p>
          <p>
            Email:{' '}
            <a href="mailto:dpo@asiancollege.edu.ph" className="font-semibold hover:underline" style={{ color: NAVY }}>
              dpo@asiancollege.edu.ph
            </a>
          </p>
        </div>
        <p>
          You may also file a complaint directly with the{' '}
          <a href="https://www.privacy.gov.ph" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: NAVY }}>
            National Privacy Commission
          </a>{' '}
          if you believe your concerns have not been adequately addressed.
        </p>
      </Section>

      <Section id="pp-9" title="9. Consent Withdrawal Process">
        <p>
          You may withdraw your consent to the processing of your personal data at any time by submitting a
          written request to the Data Protection Officer (contact details above), specifying the data or
          processing activity you wish to withdraw consent for.
        </p>
        <p>
          Please note that withdrawing consent may affect the availability of certain Platform features — for
          example, withdrawing consent for ID verification may result in restricted account access, and
          withdrawing consent for donation record-keeping may limit our ability to process or acknowledge future
          donations. Where processing is based on a legal obligation or legitimate interest rather than consent
          (e.g., certain financial or accreditation reporting), withdrawal of consent will not affect that
          processing.
        </p>
        <p>
          Upon receiving a valid withdrawal request, we will confirm the scope of withdrawal, take appropriate
          action within a reasonable period, and inform you of any resulting changes to your account or access to
          Platform features.
        </p>
      </Section>

      <div className="mt-10 pt-6 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
        By checking "I agree to the Terms &amp; Privacy Policy (RA 10173)" during registration, you acknowledge
        that you have read and understood this document in full and consent to the collection and processing of
        your personal data as described herein.
      </div>
    </div>
  );
}
