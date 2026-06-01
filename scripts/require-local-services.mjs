const value = String(process.env.LOCAL_SERVICES ?? '').trim().toLowerCase();

if (!['1', 'true', 'yes'].includes(value)) {
    console.error(
        'Refusing to start local services without LOCAL_SERVICES=yes. This repo can handle education-adjacent school, student, waitlist, CRM, and AI-provider data.'
    );
    process.exit(1);
}
