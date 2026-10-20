export default {
  eyebrow: 'FUJIPP / PRIVACY',
  title: 'Privacy.',
  description: 'How your information is used, where it goes, and the choices you have.',
  updated: 'Last updated {date}',
  contents: 'On this page',
  contact: 'Contact on Discord',
  law: 'Read about your rights under the PDPA',
  sections: {
    scope: {
      title: 'Who handles your information',
      body: 'Fujipp is operated by Anawat Boripakhirun. This notice covers personal information used for this website, user accounts, purchases, wallet top-ups, donations, and managed Discord bot services.',
      detail:
        'Information may come from you, a sign-in provider you choose, or activity in a Discord server using our bots. The information processed depends on the services and bot features in use. A server owner also controls how their bot is configured and used.',
    },
    data: {
      title: 'Information we handle',
      accountLabel: 'Account and profile',
      accountBody:
        'Email, username, name, profile image, account identifiers, and details supplied by your selected sign-in provider.',
      paymentLabel: 'Payments and support',
      paymentBody:
        'Orders, wallet entries, amounts, payment references, uploaded payment slips and verification results, and donation details.',
      botLabel: 'Bot services',
      botBody:
        'Discord bot, server, channel, role, and member identifiers; feature settings; bot credentials; and messages or transaction records needed by enabled features. Connected services, such as Roblox, may supply account and transaction identifiers.',
      technicalLabel: 'Technical and contact information',
      technicalBody:
        'IP addresses, browser information, timestamps, security events, language and theme preferences, and information you send when contacting us.',
    },
    use: {
      title: 'Why this information is used',
      body: 'We use information to create and authenticate accounts, deliver purchased services, verify payments, run configured bot features, respond to requests, and investigate misuse. Processing may be necessary to provide the service you request, meet legal obligations, or protect the legitimate interests of users and the service. Where consent is required, it must be obtained separately.',
      detail:
        'Information needed to authenticate, pay, or operate a bot is necessary for those functions; without it, the relevant service may be unavailable. Donation names and amounts may appear publicly in support rankings. You can select Anonymous when donating to hide your name from the public ranking.',
    },
    sharing: {
      title: 'Service providers and sharing',
      body: 'Services used by the website include Supabase for accounts and data storage, Cloudflare Turnstile for abuse prevention, Cloudinary for uploaded media, and SlipOK for payment-slip verification. Sign-in and bot integrations also exchange information with the providers you use, such as Google, GitHub, Discord, Roblox, or TrueMoney.',
      detail:
        'Information is shared as needed for the relevant function, support, or a legal requirement. Providers may process information outside Thailand depending on their infrastructure. External services have their own privacy policies; contact us to ask about a specific transfer or integration.',
    },
    storage: {
      title: 'Cookies and browser storage',
      body: 'The website uses browser storage to keep your sign-in session, language, and theme preferences. Authentication and security services may also use cookies or similar technologies for their functions, including Cloudflare Turnstile checks.',
      detail:
        'You can manage cookies and stored site data in your browser. Clearing or blocking this data may sign you out, reset preferences, or prevent authentication and security checks from working.',
    },
    retention: {
      title: 'How long information is kept',
      body: 'Account and bot information is kept while needed to provide the associated account or service. Payment, order, and wallet records may be retained for transaction verification, disputes, and legal obligations. Security and support records are retained according to their continuing need for investigation, abuse prevention, or resolving a request.',
      detail:
        'Removing a bot or feature does not automatically erase transaction history. You can ask about a specific record or request deletion of information that is no longer necessary; some records may still need to be retained where the law permits or requires it.',
    },
    security: {
      title: 'Protecting access',
      body: 'Access to account and administration functions is restricted by authentication and permissions. Stored bot credentials and feature secrets are encrypted. Supabase Auth handles password authentication and sign-in sessions.',
      detail:
        'Keep your account and bot credentials private. If you suspect unauthorised access or a privacy incident, contact us through the channel below.',
    },
    rights: {
      title: 'Your rights and requests',
      body: 'Subject to applicable law and its conditions, you may request access or a copy, correction, deletion, restriction, portability, or object to processing. Where processing relies on consent, you may withdraw it. You may also complain to the Personal Data Protection Committee.',
      detail:
        'Contact us with the account concerned and your request. We may need to verify your identity before responding. Some requests may be limited by legal obligations, the rights of others, or the need to retain a transaction record.',
    },
    changes: {
      title: 'Changes to this notice',
      body: 'The current notice is available on this page with its last updated date. If a change requires further notice or consent, it will be handled as required by applicable law.',
    },
    contact: {
      title: 'Talk to us about privacy',
      body: 'For privacy questions or requests, contact Anawat Boripakhirun (Fujipp) through the Fujipp Discord server and ask to speak privately with an administrator.',
      detail:
        'Please avoid posting passwords, bot tokens, payment slips, or other private information in public channels. A parent or guardian can also contact us about a child’s information.',
    },
  },
} as const
