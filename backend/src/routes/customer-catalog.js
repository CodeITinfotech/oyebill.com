import express from 'express';
import db from '../../database/index.js';

const router = express.Router();

// Get online ordering settings for a restaurant
router.get('/settings/:restaurantId', (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    let settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    
    if (!settings) {
      // Create default settings
      const id = require('uuid').v4();
      db.prepare(`
        INSERT INTO online_ordering_settings (id, restaurant_id)
        VALUES (?, ?)
      `).run(id, restaurantId);
      
      settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    }
    
    res.json({ 
      success: true, 
      data: {
        isEnabled: settings.is_enabled === 1,
        freeDeliveryRadiusKm: settings.free_delivery_radius_km,
        paidDeliveryRadiusKm: settings.paid_delivery_radius_km,
        deliveryCharge: settings.delivery_charge,
        minOrderAmount: settings.min_order_amount,
        allowPickup: settings.allow_pickup === 1,
        allowDelivery: settings.allow_delivery === 1,
        estimatedPrepTimeMinutes: settings.estimated_prep_time_minutes,
        deliveryInstructions: settings.delivery_instructions
      }
    });
  } catch (error) {
    console.error('Error fetching online ordering settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// Get restaurant info
router.get('/restaurant/:restaurantId', (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(restaurantId);
    
    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }
    
    // Get online ordering settings
    let settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    
    res.json({ 
      success: true, 
      data: {
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        logo: restaurant.logo,
        onlineOrdering: settings ? {
          isEnabled: settings.is_enabled === 1,
          allowPickup: settings.allow_pickup === 1,
          allowDelivery: settings.allow_delivery === 1,
          freeDeliveryRadiusKm: settings.free_delivery_radius_km,
          paidDeliveryRadiusKm: settings.paid_delivery_radius_km,
          deliveryCharge: settings.delivery_charge,
          estimatedPrepTimeMinutes: settings.estimated_prep_time_minutes
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch restaurant' });
  }
});

// Get menu catalog (public - products with online ordering enabled)
router.get('/menu/:restaurantId', (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Get categories with products
    const categories = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.enable_online = 1 AND p.is_active = 1) as product_count
      FROM categories c
      WHERE c.restaurant_id = ? AND c.is_active = 1
      ORDER BY c.sort_order, c.name
    `).all(restaurantId);
    
    // Get products for each category
    const categoriesWithProducts = categories.map(category => {
      const products = db.prepare(`
        SELECT id, name, description, selling_price, mrp, tax_rate, is_active, enable_online
        FROM products
        WHERE category_id = ? AND enable_online = 1 AND is_active = 1
        ORDER BY name
      `).all(category.id);
      
      return {
        ...category,
        products
      };
    }).filter(cat => cat.product_count > 0);
    
    // Get restaurant info
    const restaurant = db.prepare('SELECT id, name, address, phone FROM restaurants WHERE id = ?').get(restaurantId);
    
    res.json({ 
      success: true, 
      data: {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          phone: restaurant.phone
        },
        categories: categoriesWithProducts
      }
    });
  } catch (error) {
    console.error('Error fetching menu catalog:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch menu' });
  }
});

// Calculate delivery based on distance
router.post('/calculate-delivery', (req, res) => {
  try {
    const { restaurantId, distanceKm, orderType } = req.body;
    
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Restaurant ID is required' });
    }
    
    let settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Online ordering not configured' });
    }
    
    const freeRadius = settings.free_delivery_radius_km || 5;
    const paidRadius = settings.paid_delivery_radius_km || 10;
    const deliveryCharge = settings.delivery_charge || 0;
    
    let charge = 0;
    let message = '';
    
    if (orderType === 'pickup') {
      charge = 0;
      message = 'Free pickup - No delivery charge';
    } else if (orderType === 'delivery') {
      if (!settings.allow_delivery) {
        return res.status(400).json({ 
          success: false, 
          error: 'Delivery is not available for this restaurant' 
        });
      }
      
      if (distanceKm <= freeRadius) {
        charge = 0;
        message = `Free delivery within ${freeRadius}km`;
      } else if (distanceKm <= paidRadius) {
        charge = deliveryCharge;
        message = `Delivery charge of ₹${deliveryCharge} for distance ${freeRadius}-${paidRadius}km`;
      } else {
        return res.status(400).json({ 
          success: false, 
          error: `Delivery not available beyond ${paidRadius}km. Maximum delivery radius is ${paidRadius}km.`,
          maxRadius: paidRadius,
          freeRadius: freeRadius,
          paidRadius: paidRadius
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        distanceKm,
        orderType,
        freeRadius,
        paidRadius,
        deliveryCharge: charge,
        message
      }
    });
  } catch (error) {
    console.error('Error calculating delivery:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate delivery' });
  }
});

// Check if customer is within delivery range
router.post('/check-delivery-range', (req, res) => {
  try {
    const { restaurantId, distanceKm } = req.body;
    
    if (!restaurantId || distanceKm === undefined) {
      return res.status(400).json({ success: false, error: 'Restaurant ID and distance are required' });
    }
    
    let settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    
    if (!settings) {
      // Default settings
      settings = {
        free_delivery_radius_km: 5,
        paid_delivery_radius_km: 10,
        delivery_charge: 0,
        allow_delivery: 1,
        allow_pickup: 1
      };
    }
    
    const freeRadius = settings.free_delivery_radius_km || 5;
    const paidRadius = settings.paid_delivery_radius_km || 10;
    
    let inRange = false;
    let deliveryOption = null;
    
    if (distanceKm <= freeRadius) {
      inRange = true;
      deliveryOption = 'free';
    } else if (distanceKm <= paidRadius) {
      inRange = true;
      deliveryOption = 'paid';
    }
    
    res.json({
      success: true,
      data: {
        inRange,
        deliveryOption,
        freeRadius,
        paidRadius,
        canPickup: settings.allow_pickup === 1,
        canDelivery: settings.allow_delivery === 1 && inRange
      }
    });
  } catch (error) {
    console.error('Error checking delivery range:', error);
    res.status(500).json({ success: false, error: 'Failed to check delivery range' });
  }
});

export default router;