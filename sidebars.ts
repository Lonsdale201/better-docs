import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  betterRouteSidebar: [
    'better-route/intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'better-route/getting-started/installation',
        'better-route/getting-started/quick-start',
      ],
    },
    {
      type: 'category',
      label: 'Core',
      items: [
        'better-route/core/router',
        'better-route/core/middleware-pipeline',
        'better-route/core/request-response-and-errors',
      ],
    },
    {
      type: 'category',
      label: 'Resources',
      items: [
        'better-route/resources/overview',
        'better-route/resources/cpt-resource',
        'better-route/resources/table-resource',
        'better-route/resources/query-contract',
      ],
    },
    {
      type: 'category',
      label: 'Auth',
      items: [
        'better-route/auth/overview',
        'better-route/auth/jwt-bearer',
        'better-route/auth/jwks-rs256',
        'better-route/auth/hmac-signatures',
        'better-route/auth/cookie-nonce',
        'better-route/auth/application-password',
        'better-route/auth/ownership-guard',
      ],
    },
    {
      type: 'category',
      label: 'Write Safety',
      items: [
        'better-route/write-safety/idempotency',
        'better-route/write-safety/atomic-idempotency',
        'better-route/write-safety/single-use-tokens',
        'better-route/write-safety/optimistic-locking',
      ],
    },
    {
      type: 'category',
      label: 'Network',
      items: [
        'better-route/network/trusted-proxy',
        'better-route/network/ip-allowlist',
      ],
    },
    {
      type: 'category',
      label: 'Public-Client APIs',
      items: [
        'better-route/public-client/overview',
        'better-route/public-client/cors',
        'better-route/public-client/oauth-error-format',
      ],
    },
    {
      type: 'category',
      label: 'Support',
      items: [
        'better-route/support/crypto',
      ],
    },
    {
      type: 'category',
      label: 'Observability',
      items: [
        'better-route/observability/audit',
        'better-route/observability/metrics',
      ],
    },
    {
      type: 'category',
      label: 'WooCommerce',
      items: [
        'better-route/woocommerce/overview',
        'better-route/woocommerce/configuration',
        'better-route/woocommerce/orders',
        'better-route/woocommerce/products',
        'better-route/woocommerce/customers',
        'better-route/woocommerce/coupons',
        'better-route/woocommerce/openapi-components',
      ],
    },
    {
      type: 'category',
      label: 'OpenAPI',
      items: [
        'better-route/openapi/overview',
        'better-route/openapi/exporter',
        'better-route/openapi/openapi-endpoint',
      ],
    },
    {
      type: 'category',
      label: 'Scenarios',
      items: ['better-route/scenarios/common-scenarios'],
    },
    'better-route/agents',
    {
      type: 'category',
      label: 'Reference',
      items: [
        'better-route/reference/entry-points',
        'better-route/reference/router-api',
        'better-route/reference/resource-api',
        'better-route/reference/middleware-catalog',
        'better-route/reference/error-codes',
        'better-route/reference/faq',
      ],
    },
    {
      type: 'category',
      label: 'Release Notes',
      items: [
        'better-route/release-notes/v1.0.0',
        'better-route/release-notes/v0.6.0',
        'better-route/release-notes/v0.5.0',
        'better-route/release-notes/v0.4.0',
        'better-route/release-notes/v0.3.0',
      ],
    },
  ],

  betterDataSidebar: [
    'better-data/intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'better-data/getting-started/installation',
        'better-data/getting-started/quick-start',
      ],
    },
    {
      type: 'category',
      label: 'Core',
      items: [
        'better-data/core/data-object',
        'better-data/core/attributes',
        'better-data/core/validation',
        'better-data/core/type-coercion',
      ],
    },
    {
      type: 'category',
      label: 'Sources',
      items: [
        'better-data/sources/overview',
        'better-data/sources/post-source',
        'better-data/sources/user-source',
        'better-data/sources/term-source',
        'better-data/sources/option-source',
        'better-data/sources/row-source',
        'better-data/sources/request-source',
      ],
    },
    {
      type: 'category',
      label: 'Sinks',
      items: [
        'better-data/sinks/overview',
        'better-data/sinks/post-sink',
        'better-data/sinks/user-sink',
        'better-data/sinks/term-sink',
        'better-data/sinks/option-sink',
        'better-data/sinks/row-sink',
      ],
    },
    {
      type: 'category',
      label: 'Presenter',
      items: [
        'better-data/presenter/overview',
        'better-data/presenter/presentation-context',
        'better-data/presenter/formatting',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'better-data/security/secret',
        'better-data/security/sensitive',
        'better-data/security/encryption',
      ],
    },
    {
      type: 'category',
      label: 'Registration',
      items: ['better-data/registration/meta-key-registry'],
    },
    {
      type: 'category',
      label: 'Scenarios',
      items: ['better-data/scenarios/common-scenarios'],
    },
    'better-data/agents',
    {
      type: 'category',
      label: 'Reference',
      items: [
        'better-data/reference/api',
        'better-data/reference/attributes',
        'better-data/reference/exceptions',
        'better-data/reference/faq',
      ],
    },
    {
      type: 'category',
      label: 'Release Notes',
      items: ['better-data/release-notes/v1.0.0'],
    },
  ],

  compositionSidebar: [
    'composition/overview',
    'composition/better-route-bridge',
    'composition/openapi-with-both',
  ],
};

export default sidebars;
