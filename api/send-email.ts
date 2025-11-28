import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, body, influencerName, collaborationId, companyName, userName, userEmail, employeeId, date } = req.body;

    // Validate required fields
    if (!to || !subject || !body) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, and body are required' 
      });
    }

    // Zoho SMTP configuration
    const transporter = nodemailer.createTransport({
      host: 'smtppro.zoho.in',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: 'contact@growwik.com',
        pass: 'Growwik@8521',
      },
    });

    // Convert plain text body to HTML, preserving structure
    const bodyLines = body.split('\n');
    let htmlBody = '';
    let inSignature = false;
    
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i].trim();
      
      // Check if we're in the signature section (after "Best regards,")
      if (line.includes('Best regards') || line.includes('Growwik Media')) {
        inSignature = true;
      }
      
      // Handle subject line
      if (line.startsWith('Subject:')) {
        htmlBody += `<h2 style="color: #333; font-size: 18px; margin-bottom: 20px;">${line.replace('Subject:', '').trim()}</h2>`;
      }
      // Handle greeting
      else if (line.startsWith('Hi ') && !inSignature) {
        htmlBody += `<p style="color: #333; font-size: 16px; margin-bottom: 15px;"><strong>${line}</strong></p>`;
      }
      // Handle magic link
      else if (line.includes('http') && line.includes('/share/contract/')) {
        htmlBody += `<p style="margin: 20px 0;">
          <a href="${line.trim()}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            🔗 Contract Signing Link
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 10px; word-break: break-all;">
          ${line.trim()}
        </p>`;
      }
      // Handle emoji lines
      else if (line.startsWith('🔗')) {
        htmlBody += `<p style="color: #333; font-size: 16px; margin: 20px 0 10px 0; font-weight: 600;">${line}</p>`;
      }
      // Handle empty lines
      else if (line === '') {
        htmlBody += '<br>';
      }
      // Handle signature section
      else if (inSignature && (line.includes('Best regards') || line.includes('Growwik Media'))) {
        htmlBody += `<p style="color: #666; margin-top: 30px;">${line}</p>`;
      }
      // Handle footer details (Collaboration ID, Sent by, etc.)
      else if (line.startsWith('---') || line.startsWith('Collaboration ID:') || 
               line.startsWith('Sent by:') || line.startsWith('Email:') || 
               line.startsWith('Employee Code:') || line.startsWith('Date:')) {
        if (line.startsWith('---')) {
          htmlBody += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0 15px 0;">`;
        } else {
          htmlBody += `<p style="color: #666; font-size: 12px; margin: 5px 0;">${line}</p>`;
        }
      }
      // Regular paragraphs
      else if (line && !inSignature) {
        htmlBody += `<p style="color: #666; line-height: 1.6; margin-bottom: 15px;">${line}</p>`;
      }
      // Other signature lines
      else if (line && inSignature) {
        htmlBody += `<p style="color: #666; margin: 5px 0;">${line}</p>`;
      }
    }

    // Email options
    const mailOptions = {
      from: {
        name: 'Growwik Media',
        address: 'contact@growwik.com',
      },
      to: to,
      subject: subject,
      text: body,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          ${htmlBody}
        </div>
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId 
    });

  } catch (error: any) {
    console.error('Error sending email:', error);
    
    // Ensure we always return valid JSON
    const errorResponse = {
      error: 'Failed to send email',
      details: error?.message || 'Unknown error occurred',
      ...(error?.code && { code: error.code }),
    };
    
    return res.status(500).json(errorResponse);
  }
}

