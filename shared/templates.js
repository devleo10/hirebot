// Interview Assistant - Template System
// Handles answer templates and placeholder replacement

import { storage } from './storage.js';
import { findBestAnswer, mustache } from './utils.js';

/**
 * Pre-defined answer templates for common interview questions
 */
export const DEFAULT_TEMPLATES = {
  experience: {
    pattern: /experience|background|work history|previous role/i,
    template: "I have {{years}} years of experience in {{field}}. In my previous role at {{company}}, I {{achievement}}. This experience has prepared me for {{target_role}} because {{connection}}."
  },
  
  motivation: {
    pattern: /why.*interested|motivation|why.*company|why.*role/i,
    template: "I am particularly drawn to {{company}} because {{company_reason}}. This role excites me as it offers {{opportunity}}. My passion for {{field}} drives me to {{goal}}."
  },
  
  strength: {
    pattern: /strength|good at|skill|talent/i,
    template: "One of my key strengths is {{strength}}. For example, {{example}}. This strength has helped me {{benefit}} and would be valuable in this role because {{relevance}}."
  },
  
  weakness: {
    pattern: /weakness|improve|challenge|struggle/i,
    template: "I have been working on improving my {{weakness}}. I've taken steps such as {{improvement_action}} and have seen progress in {{progress}}. I continue to {{ongoing_effort}}."
  },
  
  achievement: {
    pattern: /achievement|accomplishment|proud|success/i,
    template: "One of my proudest achievements was {{achievement}}. The challenge was {{challenge}}, and I {{action}}. The result was {{impact}}, which {{value}}."
  },
  
  teamwork: {
    pattern: /team|collaborate|work with others/i,
    template: "I believe effective teamwork requires {{teamwork_quality}}. In my experience working with {{team_context}}, I {{contribution}}. I particularly value {{team_value}}."
  },
  
  conflict: {
    pattern: /conflict|disagreement|difficult.*person|challenge.*team/i,
    template: "When facing team conflicts, I approach them by {{approach}}. For instance, {{situation}}. I {{action}} which resulted in {{resolution}}. I learned {{lesson}}."
  },
  
  leadership: {
    pattern: /leadership|lead|manage|mentor/i,
    template: "My leadership style focuses on {{leadership_style}}. When leading {{situation}}, I {{approach}}. This resulted in {{outcome}} and helped the team {{benefit}}."
  },
  
  goals: {
    pattern: /goals|future|career|where.*see yourself/i,
    template: "My career goal is to {{goal}}. I plan to achieve this by {{plan}}. This role at {{company}} fits perfectly because {{alignment}}."
  },
  
  salary: {
    pattern: /salary|compensation|pay|money|benefits/i,
    template: "Based on my research and experience level, I'm looking for a salary in the range of {{salary_range}}. I'm open to discussing the complete compensation package including {{benefits}}."
  }
};

/**
 * Template manager for handling answer templates
 */
class TemplateManager {
  constructor() {
    this.templates = new Map();
    this.loadDefaultTemplates();
  }

  /**
   * Load default templates into the manager
   */
  loadDefaultTemplates() {
    Object.entries(DEFAULT_TEMPLATES).forEach(([key, template]) => {
      this.templates.set(key, template);
    });
  }

  /**
   * Find the best template for a given question
   * @param {string} question - The interview question
   * @returns {Object|null} Matching template or null
   */
  findTemplateForQuestion(question) {
    const questionLower = question.toLowerCase();
    
    for (const [key, template] of this.templates) {
      if (template.pattern.test(questionLower)) {
        return {
          key,
          ...template
        };
      }
    }
    
    return null;
  }

  /**
   * Generate a template-based answer
   * @param {string} question - The interview question
   * @param {Object} variables - Variables to fill in the template
   * @returns {string|null} Generated answer or null
   */
  generateAnswer(question, variables = {}) {
    const template = this.findTemplateForQuestion(question);
    
    if (!template) {
      return null;
    }
    
    try {
      return mustache(template.template, variables);
    } catch (error) {
      console.error('Error generating answer from template:', error);
      return template.template; // Return template with unfilled placeholders
    }
  }

  /**
   * Get all available templates
   * @returns {Array} Array of template objects
   */
  getAllTemplates() {
    return Array.from(this.templates.entries()).map(([key, template]) => ({
      key,
      ...template
    }));
  }

  /**
   * Add or update a custom template
   * @param {string} key - Template key
   * @param {RegExp} pattern - Pattern to match questions
   * @param {string} template - Template string with placeholders
   */
  addTemplate(key, pattern, template) {
    this.templates.set(key, { pattern, template });
  }

  /**
   * Remove a template
   * @param {string} key - Template key to remove
   * @returns {boolean} True if template was removed
   */
  removeTemplate(key) {
    return this.templates.delete(key);
  }

  /**
   * Extract placeholders from a template string
   * @param {string} template - Template string
   * @returns {Array} Array of placeholder names
   */
  extractPlaceholders(template) {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = [];
    let match;
    
    while ((match = placeholderRegex.exec(template)) !== null) {
      const placeholder = match[1].trim();
      if (!placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }
    
    return placeholders;
  }

  /**
   * Validate template variables against placeholders
   * @param {string} template - Template string
   * @param {Object} variables - Variables object
   * @returns {Object} Validation result with missing and extra variables
   */
  validateVariables(template, variables) {
    const placeholders = this.extractPlaceholders(template);
    const providedVars = Object.keys(variables);
    
    const missing = placeholders.filter(p => !providedVars.includes(p));
    const extra = providedVars.filter(v => !placeholders.includes(v));
    
    return {
      isValid: missing.length === 0,
      missing,
      extra,
      required: placeholders
    };
  }
}

/**
 * Enhanced answer matching that combines saved answers with templates
 * @param {string} question - The interview question
 * @param {Array} savedAnswers - Array of saved answers
 * @param {Object} templateVariables - Variables for template generation
 * @returns {Promise<Object>} Best answer with source information
 */
export async function findBestAnswerWithTemplates(question, savedAnswers = null, templateVariables = {}) {
  // Get saved answers if not provided
  if (!savedAnswers) {
    savedAnswers = await storage.getSavedAnswers();
  }

  // First try to find exact or similar saved answer
  const savedAnswer = findBestAnswer(question, savedAnswers);
  
  if (savedAnswer && savedAnswer.similarity > 0.7) {
    return {
      answer: savedAnswer.answer,
      similarity: savedAnswer.similarity,
      source: 'saved',
      id: savedAnswer.id,
      template: null
    };
  }

  // If no good saved answer, try templates
  const templateManager = new TemplateManager();
  const template = templateManager.findTemplateForQuestion(question);
  
  if (template) {
    const templateAnswer = templateManager.generateAnswer(question, templateVariables);
    
    if (templateAnswer) {
      return {
        answer: templateAnswer,
        similarity: 0.8, // Template match is considered high similarity
        source: 'template',
        id: null,
        template: {
          key: template.key,
          original: template.template,
          variables: templateVariables,
          placeholders: templateManager.extractPlaceholders(template.template)
        }
      };
    }
  }

  // Return saved answer even if similarity is lower, or null if nothing found
  if (savedAnswer) {
    return {
      answer: savedAnswer.answer,
      similarity: savedAnswer.similarity,
      source: 'saved',
      id: savedAnswer.id,
      template: null
    };
  }

  return null;
}

/**
 * Create a customizable answer prompt for template-based answers
 * @param {Object} templateResult - Result from findBestAnswerWithTemplates with template source
 * @returns {Object} Prompt configuration for user input
 */
export function createTemplatePrompt(templateResult) {
  if (!templateResult || templateResult.source !== 'template') {
    return null;
  }

  const { template } = templateResult;
  const placeholders = template.placeholders;
  
  return {
    question: 'Customize your answer',
    fields: placeholders.map(placeholder => ({
      name: placeholder,
      label: placeholder.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: 'text',
      required: true,
      placeholder: `Enter ${placeholder.replace(/_/g, ' ')}...`,
      value: template.variables[placeholder] || ''
    })),
    preview: template.original,
    onUpdate: (variables) => {
      return mustache(template.original, variables);
    }
  };
}

// Create and export singleton instance
export const templateManager = new TemplateManager();

// Export the class for testing
export { TemplateManager };

// Export default for convenience
export default {
  templateManager,
  findBestAnswerWithTemplates,
  createTemplatePrompt,
  DEFAULT_TEMPLATES
};
