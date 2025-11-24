/**
 * Standalone AdminJS Server
 * 
 * This script runs AdminJS on a separate port (3001) to provide
 * a full admin interface for all Prisma models.
 * 
 * Usage:
 *   node scripts/adminjs-server.mjs
 * 
 * Or add to package.json:
 *   "admin": "node scripts/adminjs-server.mjs"
 */

import AdminJS from 'adminjs';
import { buildRouter } from '@adminjs/express';
import express from 'express';
import { Database, Resource, getModelByName } from '@adminjs/prisma';
import { prisma } from '@jssprz/ludo2go-database';

// Register adapter
AdminJS.registerAdapter({ Database, Resource });

// All models to be managed by AdminJS
const allModels = [
  // Core Products & Media
  'Product', 'MediaAsset', 'ProductMedia',
  // Publishers & Details
  'Publisher', 'GameDetails', 'AccessoryDetails', 'BundleDetails', 'BGGDetails', 
  'BGGDetailsTrakingTable',
  // Variants & Media
  'ProductVariant', 'ProductLink', 'VariantMedia',
  // Timelines
  'GameTimeline', 'GameTimelineEvent',
  // Configuration
  'ProductionQualityTier', 'GameplayComplexityTier', 'BundleItem',
  // Inventory & Pricing
  'Location', 'Inventory', 'Channel', 'PriceBook', 'Price',
  // Rentals
  'MembershipTier', 'Membership', 'RentalPlan', 'RentalPlanExtension',
  'RentalAgreement', 'RentalItem',
  // Customers & Orders
  'Customer', 'Address', 'CartItem', 'Order', 'OrderItem', 'RentalOrderDetails', 'Payment',
  // Community
  'SocialPost', 'SocialPostTag', 'Review', 'ReviewVote',
  // Price Comparison
  'Store', 'ItemPriceInStore'
];

const adminJSModels = allModels;

console.log(`Setting up AdminJS for ${adminJSModels.length} models...`);

// Helper function to group models in navigation
function getNavigationGroup(modelName) {
  if (['Product', 'MediaAsset', 'ProductMedia'].includes(modelName)) {
    return '📦 Core Products';
  }
  if (['Publisher', 'GameDetails', 'AccessoryDetails', 'BundleDetails', 'BGGDetails', 'BGGDetailsTrakingTable'].includes(modelName)) {
    return '📚 Catalog Details';
  }
  if (['ProductVariant', 'ProductLink', 'VariantMedia', 'GameTimeline', 'GameTimelineEvent'].includes(modelName)) {
    return '📋 Product Variants';
  }
  if (['ProductionQualityTier', 'GameplayComplexityTier', 'BundleItem'].includes(modelName)) {
    return '⚙️ Configuration';
  }
  if (['Location', 'Inventory'].includes(modelName)) {
    return '📊 Inventory';
  }
  if (['Channel', 'PriceBook', 'Price'].includes(modelName)) {
    return '💰 Pricing';
  }
  if (['MembershipTier', 'Membership', 'RentalPlan', 'RentalPlanExtension', 'RentalAgreement', 'RentalItem'].includes(modelName)) {
    return '📅 Rentals';
  }
  if (['Customer', 'Address'].includes(modelName)) {
    return '👤 Customers';
  }
  if (['CartItem', 'Order', 'OrderItem', 'RentalOrderDetails', 'Payment'].includes(modelName)) {
    return '🛒 Orders';
  }
  if (['SocialPost', 'SocialPostTag', 'Review', 'ReviewVote'].includes(modelName)) {
    return '⭐ Community';
  }
  if (['Store', 'ItemPriceInStore'].includes(modelName)) {
    return '🏪 Price Comparison';
  }
  return 'Other';
}

// Helper function to get icons
function getIconForModel(modelName) {
  const iconMap = {
    Product: '🎮',
    MediaAsset: '🖼️',
    ProductMedia: '📎',
    Publisher: '📚',
    GameDetails: '🎲',
    AccessoryDetails: '🎨',
    BundleDetails: '📦',
    BGGDetails: '🌐',
    ProductVariant: '📋',
    Location: '📍',
    Inventory: '📊',
    Channel: '🔗',
    Price: '💰',
    MembershipTier: '⭐',
    RentalPlan: '📅',
    Customer: '👤',
    Order: '🛒',
    Review: '⭐',
    Store: '🏪',
  };
  return iconMap[modelName] || '📄';
}

// Helper function to configure properties
function getPropertiesConfig(modelName) {
  const commonConfig = {};

  // Hide internal IDs by default
  if (modelName !== 'Customer' && modelName !== 'Order') {
    commonConfig.id = { isVisible: { list: false, edit: false, show: true } };
  }

  // Format timestamps
  commonConfig.createdAt = { isVisible: { list: true, edit: false, filter: true } };
  commonConfig.updatedAt = { isVisible: { list: false, edit: false, show: true } };

  // Model-specific configurations
  switch (modelName) {
    case 'Product':
      return {
        ...commonConfig,
        name: { isTitle: true },
        slug: { isVisible: { list: true, edit: true, filter: true } },
        kind: { isVisible: { list: true, edit: true, filter: true } },
        description: { type: 'textarea' },
        shortDescription: { type: 'textarea' },
        tags: { isVisible: { list: true, edit: true, filter: true } },
      };
    
    case 'MediaAsset':
      return {
        ...commonConfig,
        url: { isTitle: true },
        kind: { isVisible: { list: true, edit: true, filter: true } },
        thumbUrl: { type: 'url' },
        width: { type: 'number' },
        height: { type: 'number' },
        sizeBytes: { type: 'number' },
      };
    
    case 'ProductMedia':
      return {
        ...commonConfig,
        role: { isVisible: { list: true, edit: true, filter: true } },
        sort: { type: 'number' },
      };
    
    case 'Publisher':
      return {
        ...commonConfig,
        name: { isTitle: true },
        logo: { type: 'url' },
        url: { type: 'url' },
      };
    
    case 'Customer':
      return {
        ...commonConfig,
        email: { isTitle: true },
        avatar: { type: 'url' },
      };
    
    case 'Order':
      return {
        ...commonConfig,
        status: { isVisible: { list: true, edit: true, filter: true } },
        total: { type: 'number' },
      };
    
    case 'Price':
      return {
        ...commonConfig,
        amount: { type: 'number' },
        currency: { isVisible: { list: true, filter: true } },
        active: { isVisible: { list: true, filter: true } },
      };
    
    case 'Review':
      return {
        ...commonConfig,
        rating: { type: 'number', props: { min: 1, max: 5 } },
        comment: { type: 'textarea' },
      };
    
    case 'Store':
      return {
        ...commonConfig,
        name: { isTitle: true },
        logo: { type: 'url' },
        url: { type: 'url' },
        rating: { type: 'number' },
      };
    
    default:
      return commonConfig;
  }
}

// Create resources for all models using the Prisma adapter
// According to @adminjs/prisma docs, we use getModelByName helper
const resources = adminJSModels.map(modelName => {
  return {
    resource: {
      model: getModelByName(modelName),
      client: prisma,
    },
    options: {
      navigation: {
        name: getNavigationGroup(modelName),
        icon: getIconForModel(modelName),
      },
      properties: getPropertiesConfig(modelName),
    },
  };
});

// Create AdminJS instance
const adminJs = new AdminJS({
  resources,
  rootPath: '/admin',
  branding: {
    companyName: 'Ludo2Go Admin',
    logo: false,
    withMadeWithLove: false,
  },
  dashboard: {
    handler: async () => {
      return {
        message: 'Welcome to Ludo2Go Admin Dashboard',
        info: `Managing ${adminJSModels.length} models across ${new Set(adminJSModels.map(getNavigationGroup)).size} categories`,
        stats: {
          totalModels: adminJSModels.length,
          categories: [...new Set(adminJSModels.map(getNavigationGroup))].sort(),
        },
      };
    },
  },
});

// Build the router
const router = buildRouter(adminJs);

// Create Express app
const app = express();
const PORT = process.env.ADMINJS_PORT || 3000;

app.use(adminJs.options.rootPath, router);

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ AdminJS is running on http://localhost:${PORT}${adminJs.options.rootPath}`);
  console.log(`\nManaging ${adminJSModels.length} models across ${new Set(adminJSModels.map(getNavigationGroup)).size} categories`);
  console.log('\nPress Ctrl+C to stop\n');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down AdminJS server...');
  await prisma.$disconnect();
  process.exit(0);
});
