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
    console.log('=== EMAIL API CALLED ===');
    console.log('Request method:', req.method);
    console.log('Request body keys:', Object.keys(req.body || {}));
    
    const { to, subject, body, influencerName, collaborationId, companyName, userName, userEmail, employeeId, date } = req.body;

    // Validate required fields
    if (!to || !subject || !body) {
      console.error('Missing required fields:', { to: !!to, subject: !!subject, body: !!body });
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, and body are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.error('Invalid email format:', to);
      return res.status(400).json({ 
        error: 'Invalid email address format',
        details: `The email address "${to}" is not valid`
      });
    }

    console.log('Email validation passed. Preparing to send email...');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body length:', body.length);

    // Zoho SMTP configuration
    const transporter = nodemailer.createTransport({
      host: 'smtppro.zoho.in',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: 'contact@growwik.com',
        pass: 'Growwik@8521',
      },
      // Add connection timeout and retry options
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
      // Debug mode for better error messages
      debug: false,
      logger: false,
    });

    // Verify SMTP connection before sending
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError: any) {
      console.error('SMTP verification failed:', verifyError);
      return res.status(500).json({
        error: 'SMTP connection failed',
        details: verifyError?.message || 'Unable to connect to email server',
        code: verifyError?.code || 'ECONNECTION',
      });
    }

    // Convert plain text body to HTML, preserving structure
    let htmlBody = '';
    try {
      const bodyLines = body.split('\n');
      let inFooter = false;
      let inProcessedBy = false;
      
      for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i].trim();
      
      // Check if we're in the footer section
      if (line.includes('Footer – User Details') || line.includes('Processed By:')) {
        inFooter = true;
        if (line.includes('Processed By:')) {
          inProcessedBy = true;
        }
      }
      
      // Check if we're in the signature section (after "Best regards,")
      if (line.includes('Best regards') || (line.includes('Growwik Media') && !inFooter)) {
        inFooter = false;
        inProcessedBy = false;
      }
      
      // Handle greeting
      if (line.startsWith('Hi ') && !inFooter) {
        htmlBody += `<p style="color: #1a1a1a; font-size: 18px; margin: 0 0 20px 0; font-weight: 600;">${line}</p>`;
      }
      // Handle magic link
      else if (line.includes('http') && line.includes('/share/contract/')) {
        const cleanLink = line.trim().replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        htmlBody += `
          <div style="margin: 30px 0; text-align: center;">
            <a href="${cleanLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); transition: all 0.3s;">
              🔗 Contract Signing Link
            </a>
          </div>
          <p style="color: #666; font-size: 13px; margin: 15px 0; text-align: center; word-break: break-all; padding: 12px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
            ${cleanLink}
          </p>`;
      }
      // Handle emoji lines
      else if (line.startsWith('🔗')) {
        htmlBody += `<p style="color: #1a1a1a; font-size: 18px; margin: 25px 0 15px 0; font-weight: 600;">${line}</p>`;
      }
      // Handle empty lines
      else if (line === '') {
        htmlBody += '<div style="height: 8px;"></div>';
      }
      // Handle "Footer – User Details" header
      else if (line.includes('Footer – User Details')) {
        htmlBody += `<hr style="border: none; border-top: 2px solid #e5e7eb; margin: 40px 0 20px 0;">`;
        htmlBody += `<p style="color: #333; font-size: 15px; font-weight: 700; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">${line}</p>`;
      }
      // Handle "Processed By:" label
      else if (line.includes('Processed By:')) {
        htmlBody += `<p style="color: #1a1a1a; font-size: 14px; font-weight: 600; margin: 20px 0 12px 0;">${line}</p>`;
      }
      // Handle bullet points (Name, Email, Employee Code, Date)
      else if (inProcessedBy && line.startsWith('•')) {
        htmlBody += `<p style="color: #555; font-size: 13px; margin: 6px 0 6px 25px; line-height: 1.5;">${line}</p>`;
      }
      // Handle signature section
      else if (line.includes('Best regards')) {
        htmlBody += `<p style="color: #1a1a1a; margin-top: 35px; margin-bottom: 8px; font-weight: 500; font-size: 15px;">${line}</p>`;
      }
      else if (line.includes('Growwik Media') && !inFooter) {
        htmlBody += `<p style="color: #667eea; margin: 0 0 0 0; font-weight: 600; font-size: 16px;">${line}</p>`;
      }
      // Regular paragraphs
      else if (line && !inFooter) {
        // Escape HTML special characters
        const escapedLine = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        htmlBody += `<p style="color: #4a5568; line-height: 1.7; margin: 0 0 18px 0; font-size: 15px;">${escapedLine}</p>`;
      }
    }
    
    console.log('HTML body generated successfully. Length:', htmlBody.length);
    } catch (htmlError: any) {
      console.error('Error generating HTML body:', htmlError);
      throw new Error(`Failed to generate email HTML: ${htmlError.message}`);
    }

    // Google Drive direct image URLs
    // Signify logo: https://drive.google.com/file/d/1-EV9JiBIzd4_n0AlBYfhXPe4GQZrj2vu/view?usp=sharing
    const signifyLogoUrl = 'https://drive.google.com/uc?export=view&id=1-EV9JiBIzd4_n0AlBYfhXPe4GQZrj2vu';
    // Growwik logo: https://drive.google.com/file/d/1t8YhI2TDzxh9A71pc4WsMFe9LIR8hQUA/view?usp=sharing
    const growwikLogoUrl = 'https://drive.google.com/uc?export=view&id=1t8YhI2TDzxh9A71pc4WsMFe9LIR8hQUA';

    console.log('Building email template...');
    
    // Email options with professional HTML template
    let mailOptions: nodemailer.SendMailOptions;
    try {
      mailOptions = {
      from: {
        name: 'Growwik Media',
        address: 'contact@growwik.com',
      },
      to: to,
      subject: subject,
      text: body,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Signing Link</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center; border-bottom: 2px solid #f0f0f0; background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 10px;">
                          <img src="${signifyLogoUrl}" alt="Signify Logo" style="height: 50px; width: auto; max-width: 150px; display: block;" onerror="this.style.display='none';">
                        </td>
                        <td style="padding: 0 10px;">
                          <img src="${growwikLogoUrl}" alt="Growwik Media Logo" style="height: 50px; width: auto; max-width: 150px; display: block;" onerror="this.style.display='none';">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              ${htmlBody}
            </td>
          </tr>

          <!-- Footer with Social Media -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 15px;">Connect with us</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://www.facebook.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #1877f2; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://twitter.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #1da1f2; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/124/124021.png" alt="Twitter" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://www.instagram.com/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://www.linkedin.com/company/growwikmedia" target="_blank" style="display: inline-block; width: 44px; height: 44px; background-color: #0077b5; border-radius: 50%; text-align: center; line-height: 44px; text-decoration: none; transition: transform 0.2s;">
                            <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 24px; height: 24px; vertical-align: middle; filter: brightness(0) invert(1);" onerror="this.style.display='none';">
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.6;">
                      <strong style="color: #333;">Growwik Media</strong><br>
                      Email: <a href="mailto:contact@growwik.com" style="color: #2563eb; text-decoration: none;">contact@growwik.com</a><br>
                      <span style="color: #999;">© ${new Date().getFullYear()} Growwik Media. All rights reserved.</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      };
      
      console.log('Email template built successfully');
    } catch (templateError: any) {
      console.error('Error building email template:', templateError);
      throw new Error(`Failed to build email template: ${templateError.message}`);
    }

    // Send email
    console.log('Attempting to send email to:', to);
    console.log('Email subject:', subject);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully. Message ID:', info.messageId);
    console.log('Response:', info.response);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId,
      response: info.response
    });

  } catch (error: any) {
    console.error('Error sending email - Full error:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error code:', error?.code);
    console.error('Error command:', error?.command);
    console.error('Error response:', error?.response);
    console.error('Error responseCode:', error?.responseCode);
    
    // Provide more detailed error messages
    let errorMessage = 'Unknown error occurred';
    let errorCode = error?.code || 'UNKNOWN';
    
    if (error?.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Please check email credentials.';
    } else if (error?.code === 'ECONNECTION' || error?.code === 'ETIMEDOUT') {
      errorMessage = 'Unable to connect to email server. Please check network connection.';
    } else if (error?.code === 'EENVELOPE') {
      errorMessage = 'Invalid email address format.';
    } else if (error?.response) {
      errorMessage = `SMTP server error: ${error.response}`;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    // Ensure we always return valid JSON
    const errorResponse = {
      error: 'Failed to send email',
      details: errorMessage,
      code: errorCode,
      ...(error?.response && { smtpResponse: error.response }),
      ...(error?.responseCode && { smtpResponseCode: error.responseCode }),
    };
    
    return res.status(500).json(errorResponse);
  }
}

