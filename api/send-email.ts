import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, body, influencerName } = req.body;

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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hello ${influencerName || 'Influencer'},</h2>
          <p style="color: #666; line-height: 1.6;">
            ${body.replace(/\n/g, '<br>')}
          </p>
          <p style="color: #666; margin-top: 20px;">
            Best regards,<br>
            <strong>Growwik Media</strong>
          </p>
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
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
}

